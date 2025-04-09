package toolsdk

import (
	"context"
	"errors"

	"github.com/coder/coder/v2/codersdk"
	"github.com/coder/coder/v2/codersdk/agentsdk"
	"github.com/google/uuid"
	"github.com/kylecarbs/aisdk-go"
)

// HandlerFunc is a function that handles a tool call.
type HandlerFunc[T any] func(ctx context.Context, args map[string]any) (T, error)

type Tool[T any] struct {
	aisdk.Tool
	Handler HandlerFunc[T]
}

var (
	ReportTask = Tool[string]{
		Tool: aisdk.Tool{
			Name:        "coder_report_task",
			Description: "Report progress on a user task in Coder.",
			Schema: aisdk.Schema{
				Properties: map[string]any{
					"summary": map[string]any{
						"type":        "string",
						"description": "A concise summary of your current progress on the task.",
					},
				},
				Required: []string{"summary"},
			},
		},
		Handler: func(ctx context.Context, args map[string]any) (string, error) {
			client, err := clientFromContext(ctx)
			if err != nil {
				return "", err
			}
			workspaceID, err := uuid.Parse(args["workspace_id"].(string))
			if err != nil {
				return "", err
			}
			workspace, err := client.Workspace(ctx, workspaceID)
			if err != nil {
				return "", err
			}
			return workspace.Name, nil
		},
	}

	CreateWorkspace = Tool[codersdk.Workspace]{
		Tool: aisdk.Tool{
			Name:        "coder_create_workspace",
			Description: "Create a new workspace in Coder.",
		},
		Handler: func(ctx context.Context, args map[string]any) (codersdk.Workspace, error) {
			client, err := clientFromContext(ctx)
			if err != nil {
				return codersdk.Workspace{}, err
			}
			workspace, err := client.CreateUserWorkspace(ctx, "me", codersdk.CreateWorkspaceRequest{})
			if err != nil {
				return codersdk.Workspace{}, err
			}
			return workspace, nil
		},
	}
)

func clientFromContext(ctx context.Context) (*codersdk.Client, error) {
	client, ok := ctx.Value(clientContextKey{}).(*codersdk.Client)
	if !ok {
		return nil, errors.New("client required in context")
	}
	return client, nil
}

type clientContextKey struct{}

func WithClient(ctx context.Context, client *codersdk.Client) context.Context {
	return context.WithValue(ctx, clientContextKey{}, client)
}

type agentClientContextKey struct{}

func WithAgentClient(ctx context.Context, client *agentsdk.Client) context.Context {
	return context.WithValue(ctx, agentClientContextKey{}, client)
}

func agentClientFromContext(ctx context.Context) (*agentsdk.Client, error) {
	client, ok := ctx.Value(agentClientContextKey{}).(*agentsdk.Client)
	if !ok {
		return nil, errors.New("agent client required in context")
	}
	return client, nil
}
