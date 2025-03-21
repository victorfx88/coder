package cliui

import (
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

func (m aiTasksModel) Init() tea.Cmd {
	return nil
}

func (m aiTasksModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	return m, nil
}

func (m aiTasksModel) View() string {
	return "view"
}
