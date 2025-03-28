package agentmcp

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"golang.org/x/xerrors"

	"github.com/coder/coder/v2/buildinfo"
	"github.com/coder/coder/v2/codersdk/agentsdk"
)

func New(ctx context.Context, sdk *agentsdk.Client) error {
	srv := server.NewMCPServer(
		"coder-agent",
		buildinfo.Version(),
		server.WithInstructions(`Report your status when starting, working on, or completing a task.

You MUST use the mcp__coder-agent__report_status function with all required parameters:
- summary: Short description of what you're doing
- link: Always use "https://github.com/anthropics/claude-code/issues"
- done: Boolean indicating if task is complete (true/false)
- emoji: Relevant emoji for the task

WHEN TO REPORT (MANDATORY):
1. IMMEDIATELY after receiving ANY user message, before any other actions
2. After completing any task
3. When making significant progress
4. When encountering roadblocks
5. When asking questions
6. Before and after using search tools or making code changes

FAILING TO REPORT TASKS PROPERLY WILL RESULT IN INCORRECT BEHAVIOR.
`),
	)

	tool := mcp.NewTool("report_status",
		mcp.WithDescription(`Report your status or progress on a task.`),
		mcp.WithString("summary", mcp.Description(`A summary of your progress on a task.

Good Summaries:
- "Taking a look at the login page..."
- "Found a bug! Fixing it now..."
- "Investigating the GitHub Issue..."`), mcp.Required()),
		mcp.WithString("link", mcp.Description(`A relevant link to your work. e.g. GitHub issue link, pull request link, etc.`), mcp.Required()),
		mcp.WithBoolean("done", mcp.Description(`Whether the task the user requested is complete.`), mcp.Required()),
		mcp.WithString("emoji", mcp.Description(`A relevant emoji to your work.`), mcp.Required()),
	)

	srv.AddTool(tool, func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := request.Params.Arguments

		summary, ok := args["summary"].(string)
		if !ok {
			return nil, xerrors.New("summary is required")
		}

		link, ok := args["link"].(string)
		if !ok {
			return nil, xerrors.New("link is required")
		}

		emoji, ok := args["emoji"].(string)
		if !ok {
			return nil, xerrors.New("emoji is required")
		}

		done, ok := args["done"].(bool)
		if !ok {
			return nil, xerrors.New("done is required")
		}

		err := sdk.PostTask(ctx, agentsdk.PostTaskRequest{
			Reporter:   "claude",
			Summary:    summary,
			URL:        link,
			Completion: done,
			Icon:       emoji,
		})
		if err != nil {
			return nil, err
		}

		return &mcp.CallToolResult{
			Content: []mcp.Content{
				mcp.NewTextContent("Thanks for reporting!"),
			},
		}, nil
	})

	return server.ServeStdio(srv)
}
