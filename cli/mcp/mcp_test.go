package mcp_test

import (
	"context"
	"testing"
	"time"

	"github.com/coder/coder/v2/agent/agenttest"
	"github.com/coder/coder/v2/cli/mcp"
	"github.com/coder/coder/v2/coderd/coderdtest"
	"github.com/coder/coder/v2/codersdk"
	"github.com/coder/coder/v2/provisioner/echo"
	"github.com/coder/coder/v2/provisionersdk/proto"
	"github.com/google/uuid"
	mcpclient "github.com/mark3labs/mcp-go/client"
	mcpgo "github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/stretchr/testify/require"
)

func TestMCP(t *testing.T) {
	t.Parallel()
	t.Run("list-workspaces", func(t *testing.T) {
		t.Parallel()
		client := coderdtest.New(t, &coderdtest.Options{
			IncludeProvisionerDaemon: true,
		})
		user := coderdtest.CreateFirstUser(t, client)
		version := coderdtest.CreateTemplateVersion(t, client, user.OrganizationID, echo.WithResources([]*proto.Resource{{
			Name: "test",
			Type: "aws_instance",
		}}))
		coderdtest.AwaitTemplateVersionJobCompleted(t, client, version.ID)
		template := coderdtest.CreateTemplate(t, client, user.OrganizationID, version.ID)
		ws1 := coderdtest.CreateWorkspace(t, client, template.ID)
		coderdtest.AwaitWorkspaceBuildJobCompleted(t, client, ws1.LatestBuild.ID)

		mcpClient := setup(t, client)
		tools, err := mcpClient.ListTools(context.Background(), mcpgo.ListToolsRequest{})
		require.NoError(t, err)
		require.NotEmpty(t, tools)

		tool := mcpgo.CallToolRequest{}
		tool.Params.Name = "list-workspaces"
		resp, err := mcpClient.CallTool(context.Background(), tool)
		require.NoError(t, err)
		require.Len(t, resp.Content, 2)
	})
	t.Run("execute-command-sync", func(t *testing.T) {
		t.Parallel()
		client := coderdtest.New(t, &coderdtest.Options{
			IncludeProvisionerDaemon: true,
		})
		user := coderdtest.CreateFirstUser(t, client)
		agentToken := uuid.New().String()
		version := coderdtest.CreateTemplateVersion(t, client, user.OrganizationID, echo.WithResources([]*proto.Resource{{
			Name: "test",
			Type: "aws_instance",
			Agents: []*proto.Agent{{
				Id:   uuid.New().String(),
				Name: "test-agent",
				Auth: &proto.Agent_Token{
					Token: agentToken,
				},
			}},
		}}))
		coderdtest.AwaitTemplateVersionJobCompleted(t, client, version.ID)
		template := coderdtest.CreateTemplate(t, client, user.OrganizationID, version.ID)
		ws := coderdtest.CreateWorkspace(t, client, template.ID)
		build := coderdtest.AwaitWorkspaceBuildJobCompleted(t, client, ws.LatestBuild.ID)
		agent := agenttest.New(t, client.URL, agentToken)
		defer agent.Close()

		mcpClient := setup(t, client)

		tool := mcpgo.CallToolRequest{}
		tool.Params.Name = "execute-command-sync"
		tool.Params.Arguments = map[string]interface{}{
			"workspace-agent-id": build.Resources[0].Agents[0].ID,
			"command":            "echo 'Hello, world!'",
		}
		resp, err := mcpClient.CallTool(context.Background(), tool)
		require.NoError(t, err)

		_ = resp
	})
}

func setup(t *testing.T, client *codersdk.Client) *mcpclient.SSEMCPClient {
	srv := mcp.New(context.Background(), func() (*codersdk.Client, error) {
		return client, nil
	}, nil)
	testServer := server.NewTestServer(srv)
	t.Cleanup(testServer.Close)

	c, err := mcpclient.NewSSEMCPClient(testServer.URL + "/sse")
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	t.Cleanup(cancel)

	err = c.Start(ctx)
	require.NoError(t, err)

	req := mcpgo.InitializeRequest{}
	req.Params.ProtocolVersion = mcpgo.LATEST_PROTOCOL_VERSION
	req.Params.ClientInfo = mcpgo.Implementation{
		Name:    "test-client",
		Version: "1.0.0",
	}
	_, err = c.Initialize(ctx, req)
	require.NoError(t, err)
	return c
}
