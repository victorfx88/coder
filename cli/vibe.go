package cli

// The "vibe" command will launch a UI for interacting with AI Agents running
// in different Coder workspaces.

import (
	"fmt"

	"github.com/coder/coder/v2/codersdk"
	"github.com/coder/serpent"
	"golang.org/x/xerrors"
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
			workspace, err := namedWorkspace(inv.Context(), client, inv.Args[0])
			if err != nil {
				return xerrors.Errorf("get workspace: %w", err)
			}

			aiTasks := []codersdk.WorkspaceAgentTask{}
			for _, resource := range workspace.LatestBuild.Resources {
				agents := resource.Agents
				if len(agents) == 0 {
					continue
				}

				for _, agent := range agents {
					tasks := agent.Tasks
					if len(tasks) == 0 {
						continue
					}

					for _, task := range tasks {
						aiTasks = append(aiTasks, task)
					}
				}
			}

			fmt.Printf("%v", aiTasks)
			return nil
		},
	}
}
