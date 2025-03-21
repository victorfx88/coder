package cliui

import (
	"context"
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"golang.org/x/xerrors"

	"github.com/coder/coder/v2/codersdk"
	"github.com/coder/serpent"
)

func AITasks(inv *serpent.Invocation) error {
	initModel := initialModel()

	p := tea.NewProgram(
		initModel,
		tea.WithoutSignalHandler(),
		tea.WithContext(inv.Context()),
		tea.WithInput(inv.Stdin),
		tea.WithOutput(inv.Stdout),
	)

	closeSignalHandler := installSignalHandler(p)
	defer closeSignalHandler()

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
	ctx      context.Context
	client   *codersdk.Client
	canceled bool
	tasks    []aiTask
}

func initialModel() aiTasksModel {
	return aiTasksModel{}
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

func (m aiTasksModel) Init() tea.Cmd {
	return func() tea.Msg {
		tasks, err := fetchTasks(m.ctx, m.client)
		if err != nil {
			return nil
		}
		return newTasksFetched{tasks: tasks}
	}
}

func (m aiTasksModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case terminateMsg:
		m.canceled = true
		return m, tea.Quit

	case newTasksFetched:
		m.tasks = msg.tasks
		return m, nil
	}

	return m, cmd
}

func (m aiTasksModel) View() string {
	return fmt.Sprintf("%v", m.tasks)
}
