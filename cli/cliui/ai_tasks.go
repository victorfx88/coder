package cliui

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os/exec"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/jedib0t/go-pretty/v6/table"
	"golang.org/x/xerrors"

	"github.com/coder/coder/v2/codersdk"
	"github.com/coder/pretty"
	"github.com/coder/serpent"
)

func AITasks(inv *serpent.Invocation, client *codersdk.Client) error {
	initModel := initialModel(client, inv.Context())

	p := tea.NewProgram(
		initModel,
		tea.WithContext(inv.Context()),
		tea.WithInput(inv.Stdin),
		tea.WithOutput(inv.Stdout),
	)

	m, err := p.Run()
	if err != nil {
		return err
	}

	model, ok := m.(aiTasksModel)
	if !ok {
		return xerrors.New(fmt.Sprintf("unknown model found %T (%+v)", m, m))
	}

	if model.canceled {
		return Canceled
	}

	return nil
}

type aiTasksModel struct {
	ctx               context.Context
	client            *codersdk.Client
	canceled          bool
	tasks             []aiTask
	inputs            []textinput.Model
	activeInput       int
	focusedInput      bool
	selectedTask      int
	viewMode          viewMode
	taskBeingReviewed *aiTask
	aiResponse        string
	aiInputActive     bool
}

func (m aiTasksModel) currentWorkspace() string {
	return m.tasks[m.selectedTask].workspace.Name
}

// Define view modes for the UI
type viewMode int

const (
	taskListMode viewMode = iota
	conversationMode
)

func initialModel(client *codersdk.Client, ctx context.Context) aiTasksModel {
	return aiTasksModel{
		client:            client,
		tasks:             []aiTask{},
		canceled:          false,
		ctx:               ctx,
		inputs:            []textinput.Model{},
		activeInput:       0,
		focusedInput:      false,
		selectedTask:      0,
		viewMode:          taskListMode,
		taskBeingReviewed: nil,
		aiResponse:        "",
		aiInputActive:     false,
	}
}

type aiTask struct {
	summary        string
	waitingOnInput bool
	workspace      codersdk.Workspace
}

func fetchTasks(ctx context.Context, client *codersdk.Client) ([]aiTask, error) {

	workspaces, err := client.Workspaces(ctx, codersdk.WorkspaceFilter{Owner: "me"})
	if err != nil {
		// TODO: make return error cmd
		return nil, xerrors.Errorf("could not fetch owned workspaces: %w", err)
	}

	tasks := []aiTask{}
	for _, w := range workspaces.Workspaces {
		for _, r := range w.LatestBuild.Resources {
			for _, a := range r.Agents {
				if len(a.Tasks) != 0 {
					mostRecentTask := a.Tasks[0]
					tasks = append(tasks, aiTask{
						summary:        mostRecentTask.Summary,
						waitingOnInput: a.TaskWaitingForUserInput,
						workspace:      w,
					})
				}
			}
		}

	}

	return tasks, nil
}

type newTasksFetched struct {
	tasks []aiTask
}

type WorkspaceAgentIOConnection struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser
}

func getWorkspaceAgentIoConnection(workspaceName string) (*WorkspaceAgentIOConnection, error) {
	cmd := exec.Command("coder", "ssh", workspaceName)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, xerrors.Errorf("failed to get stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, xerrors.Errorf("failed to get stdout pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, xerrors.Errorf("failed to start command: %w", err)
	}

	return &WorkspaceAgentIOConnection{
		cmd:    cmd,
		stdin:  stdin,
		stdout: stdout,
	}, nil
}

func (wc *WorkspaceAgentIOConnection) Close() error {
	// Should close the stdin/stdout pipes
	if err := wc.cmd.Wait(); err != nil {
		return err
	}

	return nil
}

func (wc *WorkspaceAgentIOConnection) Write(p []byte) (int, error) {
	return wc.stdin.Write(p)
}

func (wc *WorkspaceAgentIOConnection) Read(p []byte) (int, error) {
	return wc.stdout.Read(p)
}

func (m aiTasksModel) Init() tea.Cmd {
	return func() tea.Msg {
		tasks, err := fetchTasks(m.ctx, m.client)
		if err != nil {
			return err
		}
		return newTasksFetched{tasks: tasks}
	}
}

type aiResponseMsg struct {
	response string
}

func (m aiTasksModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q", "esc":
			if m.viewMode == conversationMode {
				// Return to task list mode
				m.viewMode = taskListMode
				return m, nil
			}
			m.canceled = true
			return m, tea.Quit

		case "tab":
			if m.viewMode == taskListMode {
				// In task list mode, tab selects the next workspace
				if len(m.tasks) > 0 {
					m.selectedTask = (m.selectedTask + 1) % len(m.tasks)
					return m, nil
				}
			} else if m.viewMode == conversationMode {
				// In conversation mode, toggle focus between AI input
				m.aiInputActive = !m.aiInputActive
				if m.aiInputActive && len(m.inputs) > 0 {
					m.inputs[0].Focus()
				} else if len(m.inputs) > 0 {
					m.inputs[0].Blur()
				}
				return m, nil
			}

		case "shift+tab":
			if m.viewMode == taskListMode {
				// In task list mode, shift+tab selects the previous workspace
				if len(m.tasks) > 0 {
					m.selectedTask = (m.selectedTask - 1 + len(m.tasks)) % len(m.tasks)
					return m, nil
				}
			}

		case "enter":
			if m.viewMode == taskListMode {
				// In task list mode, enter switches to conversation mode
				if len(m.tasks) > 0 {
					m.viewMode = conversationMode

					// Initialize AI input field if needed
					if len(m.inputs) == 0 {
						ti := textinput.New()
						ti.Placeholder = "Type your message to AI..."
						ti.CharLimit = 500
						ti.Width = 50
						ti.Prompt = "> "
						m.inputs = append(m.inputs, ti)
					}

					// Focus the AI input by default
					m.aiInputActive = true
					m.inputs[0].Focus()

					return m, nil
				}
			} else if m.viewMode == conversationMode {
				// In conversation mode, enter sends the AI input
				if m.aiInputActive && len(m.inputs) > 0 {
					currentInput := m.inputs[0].Value()
					if currentInput != "" {
						// Send the message to the AI
						return m, func() tea.Msg {

							// In a real implementation, you would connect to the workspace and send the message
							// For example:
							conn, err := getWorkspaceAgentIoConnection(m.currentWorkspace())
							if err != nil {
								return err
							}
							defer conn.Close()

							_, err = conn.Write([]byte(currentInput + "\n"))
							if err != nil {
								return err
							}

							buf := new(bytes.Buffer)
							_, err = io.Copy(buf, conn)
							if err != nil {
								return err
							}
							response := buf.String()

							// Clear the input field
							m.inputs[0].SetValue("")
							return aiResponseMsg{response: response}
						}
					}
				}
			}
		}

		// Handle input for the AI conversation
		if m.viewMode == conversationMode && m.aiInputActive && len(m.inputs) > 0 {
			m.inputs[0], cmd = m.inputs[0].Update(msg)
			return m, cmd
		}

	case terminateMsg:
		m.canceled = true
		return m, tea.Quit

	case aiResponseMsg:
		// Update the AI response text
		m.aiResponse = msg.response
		return m, nil

	case newTasksFetched:
		m.tasks = msg.tasks

		// If there are no tasks, clear any existing inputs
		if len(m.tasks) == 0 {
			m.inputs = []textinput.Model{}
			return m, nil
		}

		// Initialize single AI input for conversation mode
		if m.viewMode == conversationMode && len(m.inputs) == 0 {
			ti := textinput.New()
			ti.Placeholder = "Type your message to AI..."
			ti.CharLimit = 500
			ti.Width = 50
			ti.Prompt = "> "
			m.inputs = append(m.inputs, ti)
		}

		return m, nil
	}

	return m, cmd
}

func (m aiTasksModel) View() string {
	if len(m.tasks) == 0 {
		return "No AI tasks found."
	}

	// Different views depending on the mode
	switch m.viewMode {
	case taskListMode:
		return m.renderTaskListView()
	case conversationMode:
		return m.renderConversationView()
	default:
		return "Unknown view mode"
	}
}

func (m aiTasksModel) renderTaskListView() string {
	var output string

	tableWriter := table.NewWriter()
	tableWriter.SetStyle(table.StyleLight)
	tableWriter.Style().Options.SeparateColumns = false
	tableWriter.AppendHeader(table.Row{"Workspace", "Task Summary", "Status", "Link"})

	for i, task := range m.tasks {
		status := "Working"
		if task.waitingOnInput {
			status = pretty.Sprint(DefaultStyles.Warn, "Waiting for input")
		}

		// Highlight the currently selected row
		workspaceName := task.workspace.Name
		taskSummary := task.summary
		if i == m.selectedTask {
			workspaceName = pretty.Sprint(DefaultStyles.Keyword, "→ "+workspaceName)
			taskSummary = pretty.Sprint(DefaultStyles.Keyword, taskSummary)
		}

		tableWriter.AppendRow(table.Row{
			workspaceName,
			taskSummary,
			status,
			pretty.Sprint(DefaultStyles.Code, "coder ssh "+task.workspace.Name),
		})
	}

	output = tableWriter.Render()
	output += "\n\n"

	output += "Press TAB to navigate between workspaces.\n"
	output += "Press ENTER to open the conversation with the AI for the selected workspace.\n"
	output += "Press ESC or q to quit."

	return output
}

func (m aiTasksModel) renderConversationView() string {
	var output string

	// Show which workspace we're viewing
	if m.selectedTask < len(m.tasks) {
		selectedWorkspace := m.tasks[m.selectedTask].workspace.Name
		output = pretty.Sprint(DefaultStyles.Keyword, "Conversation with AI in workspace: "+selectedWorkspace) + "\n\n"

		// Show task summary
		output += "Task: " + m.tasks[m.selectedTask].summary + "\n\n"

		// Show AI response area with a border
		output += "AI Response:\n"
		output += "┌" + strings.Repeat("─", 60) + "┐\n"

		// If there's an AI response, show it with wrapping
		if m.aiResponse != "" {
			// Simple wrapping for the response
			maxWidth := 58
			words := strings.Fields(m.aiResponse)
			line := "│ "
			for _, word := range words {
				if len(line)+len(word) > maxWidth {
					// Add padding to fill the box width
					padding := strings.Repeat(" ", maxWidth-len(line)+2)
					output += line + padding + "│\n"
					line = "│ " + word + " "
				} else {
					line += word + " "
				}
			}
			// Add final line with padding
			padding := strings.Repeat(" ", maxWidth-len(line)+2)
			output += line + padding + "│\n"
		} else {
			// Empty response
			output += "│" + strings.Repeat(" ", 60) + "│\n"
		}

		output += "└" + strings.Repeat("─", 60) + "┘\n\n"

		// Show input box
		if len(m.inputs) > 0 {
			output += "Your message to AI:\n"
			output += m.inputs[0].View() + "\n\n"
		}

		// Show instructions
		output += "Press TAB to focus on the input box.\n"
		output += "Press ENTER to send your message to the AI.\n"
		output += "Press ESC to return to the workspace list."
	} else {
		output = "No workspace selected."
	}

	return output
}
