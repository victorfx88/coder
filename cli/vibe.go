package cli

// The "vibe" command will launch a UI for interacting with AI Agents running
// in different Coder workspaces.

import (
	"github.com/coder/coder/v2/cli/cliui"
	"github.com/coder/coder/v2/codersdk"
	"github.com/coder/serpent"
)

func (r *RootCmd) vibe() *serpent.Command {
	client := new(codersdk.Client)
	return &serpent.Command{
		Use:   "vibe [workspace]",
		Short: "Display AI tasks running in different Coder Workspaces",
		Long:  "Display AI tasks running in different Coder Workspaces",
		Middleware: serpent.Chain(
			serpent.RequireNArgs(1),
			r.InitClient(client),
		),
		Handler: func(inv *serpent.Invocation) error {
			return cliui.AITasks(inv)
		},
	}
}
