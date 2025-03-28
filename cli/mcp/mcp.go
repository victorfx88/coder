package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/netip"
	"strconv"
	"strings"
	"sync"

	"github.com/coder/coder/v2/buildinfo"
	"github.com/coder/coder/v2/codersdk"
	"github.com/coder/coder/v2/codersdk/workspacesdk"
	"github.com/google/uuid"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"golang.org/x/crypto/ssh"
)

type Options struct {
}

// Global map to track active port forwards
var (
	portForwards = make(map[int32]net.Listener)
	pfMutex      sync.Mutex
)

func New(ctx context.Context, client func() (*codersdk.Client, error), opts *Options) *server.MCPServer {
	srv := server.NewMCPServer("Coder", buildinfo.Version(),
		server.WithInstructions(""),
	)

	type agentConn struct {
		Conn *workspacesdk.AgentConn
		SSH  *ssh.Client
	}
	agentConnections := make(map[string]*agentConn)
	commands := make(map[string]*command)

	ensureWorkspaceAgentConn := func(agentID string) (*agentConn, error) {
		conn, ok := agentConnections[agentID]
		if ok {
			reachable := conn.Conn.AwaitReachable(ctx)
			if !reachable {
				return nil, fmt.Errorf("agent not reachable")
			}
			ok = false
		}
		if !ok {
			agentUUID, err := uuid.Parse(agentID)
			if err != nil {
				return nil, fmt.Errorf("invalid agent ID: %w", err)
			}
			conn = &agentConn{}
			client, err := client()
			if err != nil {
				return nil, err
			}
			conn.Conn, err = workspacesdk.New(client).DialAgent(ctx, agentUUID, nil)
			if err != nil {
				return nil, err
			}
			reachable := conn.Conn.AwaitReachable(ctx)
			if !reachable {
				return nil, fmt.Errorf("agent not reachable")
			}
			agentConnections[agentID] = conn
		}
		return conn, nil
	}
	ensureSSHClient := func(agentConn *agentConn) (*ssh.Client, error) {
		if agentConn.SSH != nil {
			return agentConn.SSH, nil
		}
		sshClient, err := agentConn.Conn.SSHClient(ctx)
		if err != nil {
			return nil, err
		}
		agentConn.SSH = sshClient
		return sshClient, nil
	}

	srv.AddResourceTemplate(mcp.NewResourceTemplate("users://{id}", "user",
		mcp.WithTemplateDescription("Query a user by username or ID. Use the `me` keyword to query the current authenticated user."),
		mcp.WithTemplateMIMEType("application/json"),
	), func(ctx context.Context, request mcp.ReadResourceRequest) ([]mcp.ResourceContents, error) {
		params := extractURIParams(request.Params.URI, "users://{id}")
		client, err := client()
		if err != nil {
			return nil, err
		}
		user, err := client.User(ctx, params["id"])
		if err != nil {
			return nil, err
		}
		json, err := json.Marshal(user)
		if err != nil {
			return nil, err
		}
		return []mcp.ResourceContents{
			mcp.TextResourceContents{
				MIMEType: "application/json",
				URI:      request.Params.URI,
				Text:     string(json),
			},
		}, nil
	})

	srv.AddTools(
		server.ServerTool{
			Tool: mcp.NewTool("list-workspaces",
				mcp.WithDescription("Lists workspaces for the authenticated user. A workspace is the environment that a developer works in. It can have multiple resources provisioned for it, defined by a template. Check `latest_build` for the state of a workspace, along with running resources and agents. To find a single workspace by name, use the `name` parameter. If a workspace is running Claude Code or some other AI agent app, you can view the `tasks` on a workspace agent to summarize tasks that the AI agent is performing."),
				mcp.WithString("owner",
					mcp.Description("Owner can be \"me\" or a username."),
					mcp.DefaultString("me"),
				),
				mcp.WithString("template",
					mcp.Description("Template is a template name to filter workspaces by."),
				),
				mcp.WithString("name",
					mcp.Description("Name is a partial match for the workspace name."),
				),
				mcp.WithString("status",
					mcp.Description("Status is a workspace status to filter workspaces by."),
					mcp.Enum("running", "stopped", "failed", "pending"),
				),
				mcp.WithNumber("offset",
					mcp.Description("Offset is the number of workspaces to skip before returning results."),
				),
				mcp.WithNumber("limit",
					mcp.Description("Limit is the number of workspaces to return."),
					mcp.DefaultNumber(10),
				),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				client, err := client()
				if err != nil {
					return nil, err
				}
				var (
					owner    string
					template string
					name     string
					status   string
					offset   int
					limit    int
				)
				if request.Params.Arguments != nil {
					owner = tryValue[string](request.Params.Arguments, "owner")
					template = tryValue[string](request.Params.Arguments, "template")
					name = tryValue[string](request.Params.Arguments, "name")
					status = tryValue[string](request.Params.Arguments, "status")
					offset = tryValue[int](request.Params.Arguments, "offset")
					limit = tryValue[int](request.Params.Arguments, "limit")
				}
				workspaces, err := client.Workspaces(ctx, codersdk.WorkspaceFilter{
					Owner:    owner,
					Template: template,
					Name:     name,
					Status:   status,
					Offset:   offset,
					Limit:    limit,
				})
				if err != nil {
					return nil, err
				}
				content := []mcp.Content{
					mcp.NewTextContent(fmt.Sprintf("Found %d workspaces!", len(workspaces.Workspaces))),
				}
				for _, workspace := range workspaces.Workspaces {
					workspaceJSON, err := json.Marshal(workspace)
					if err != nil {
						return nil, err
					}
					content = append(content, mcp.NewTextContent(string(workspaceJSON)))
				}
				return &mcp.CallToolResult{
					Content: content,
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("list-templates",
				mcp.WithDescription("Lists templates for the authenticated user."),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				client, err := client()
				if err != nil {
					return nil, err
				}
				templates, err := client.Templates(ctx, codersdk.TemplateFilter{})
				if err != nil {
					return nil, err
				}
				// Save on tokens!
				type minimalTemplate struct {
					DisplayName     string    `json:"display_name"`
					ID              string    `json:"id"`
					Name            string    `json:"name"`
					Description     string    `json:"description"`
					ActiveVersionID uuid.UUID `json:"active_version_id"`
					ActiveUserCount int       `json:"active_user_count"`
				}
				minimalTemplates := []minimalTemplate{}
				for _, template := range templates {
					minimalTemplates = append(minimalTemplates, minimalTemplate{
						DisplayName:     template.DisplayName,
						ID:              template.ID.String(),
						Name:            template.Name,
						Description:     template.Description,
						ActiveVersionID: template.ActiveVersionID,
						ActiveUserCount: template.ActiveUserCount,
					})
				}
				minimalTemplatesJSON, err := json.Marshal(minimalTemplates)
				if err != nil {
					return nil, err
				}
				return &mcp.CallToolResult{
					Content: []mcp.Content{
						mcp.NewTextContent(fmt.Sprintf("Found %d templates!", len(templates))),
						mcp.NewTextContent(string(minimalTemplatesJSON)),
					},
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("get-template-version-parameters",
				mcp.WithDescription("Get the parameters for a template version. You can refer to these as workspace parameters to the user, as they are typically important for creating a workspace."),
				mcp.WithString("template-version-id", mcp.Description("The ID of the template version to get the parameters for."), mcp.Required()),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				templateVersionIDRaw, ok := request.Params.Arguments["template-version-id"].(string)
				if !ok {
					return nil, fmt.Errorf("template-version-id is required")
				}
				templateVersionID, err := uuid.Parse(templateVersionIDRaw)
				if err != nil {
					return nil, fmt.Errorf("invalid template-version-id: %w", err)
				}
				client, err := client()
				if err != nil {
					return nil, err
				}
				parameters, err := client.TemplateVersionRichParameters(ctx, templateVersionID)
				if err != nil {
					return nil, err
				}
				content := []mcp.Content{
					mcp.NewTextContent(fmt.Sprintf("This template version has %d parameters!", len(parameters))),
				}
				for _, parameter := range parameters {
					parameterJSON, err := json.Marshal(parameter)
					if err != nil {
						return nil, err
					}
					content = append(content, mcp.NewTextContent(string(parameterJSON)))
				}
				return &mcp.CallToolResult{
					Content: content,
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("get-template-version-readme",
				mcp.WithDescription("Get the README for a template version. Useful for understanding what happens when a workspace is created."),
				mcp.WithString("template-version-id", mcp.Description("The ID of the template version to get the README for."), mcp.Required()),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				templateVersionIDRaw, ok := request.Params.Arguments["template-version-id"].(string)
				if !ok {
					return nil, fmt.Errorf("template-version-id is required")
				}
				templateVersionID, err := uuid.Parse(templateVersionIDRaw)
				if err != nil {
					return nil, fmt.Errorf("invalid template-version-id: %w", err)
				}
				client, err := client()
				if err != nil {
					return nil, err
				}
				version, err := client.TemplateVersion(ctx, templateVersionID)
				if err != nil {
					return nil, err
				}
				return &mcp.CallToolResult{
					Content: []mcp.Content{mcp.NewTextContent(version.Readme)},
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("create-workspace",
				mcp.WithDescription("Creates a workspace for the authenticated user."),
				mcp.WithString("user", mcp.Description("Username or ID of the user to create the workspace for. Use the `me` keyword to create a workspace for the authenticated user."), mcp.Required()),
				mcp.WithString("template-version-id", mcp.Description("The version ID of the template to create the workspace from. List templates to get the active template version ID. To gain additional information about a template version, use the `get-template-version-readme` tool. Be sure to use the contextually correct template."), mcp.Required()),
				mcp.WithString("name", mcp.Description("The name of the workspace to create."), mcp.Required()),
				mcp.WithObject("rich-parameters", mcp.Description("Rich parameter values for the template version. Use `get-template-version-parameters` to get the parameters for a template version. If you are uncertain about the value a parameter should have, please ask the user."), mcp.Required()),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				user, ok := request.Params.Arguments["user"].(string)
				if !ok {
					return nil, fmt.Errorf("user is required")
				}
				templateVersionIDRaw, ok := request.Params.Arguments["template-version-id"].(string)
				if !ok {
					return nil, fmt.Errorf("template-id is required")
				}
				templateVersionID, err := uuid.Parse(templateVersionIDRaw)
				if err != nil {
					return nil, fmt.Errorf("invalid template-id: %w", err)
				}
				name, ok := request.Params.Arguments["name"].(string)
				if !ok {
					return nil, fmt.Errorf("name is required")
				}
				richParameters, ok := request.Params.Arguments["rich-parameters"].(map[string]any)
				if !ok {
					return nil, fmt.Errorf("rich-parameters is required")
				}
				richParameterValues := []codersdk.WorkspaceBuildParameter{}
				for k, v := range richParameters {
					var value string
					switch v := v.(type) {
					case string:
						value = v
					case bool:
						value = strconv.FormatBool(v)
					case int:
						value = strconv.Itoa(v)
					case float64:
						value = strconv.FormatFloat(v, 'f', -1, 64)
					}
					richParameterValues = append(richParameterValues, codersdk.WorkspaceBuildParameter{
						Name:  k,
						Value: value,
					})
				}
				client, err := client()
				if err != nil {
					return nil, err
				}
				workspace, err := client.CreateUserWorkspace(ctx, user, codersdk.CreateWorkspaceRequest{
					TemplateVersionID:   templateVersionID,
					Name:                name,
					RichParameterValues: richParameterValues,
				})
				if err != nil {
					return nil, err
				}
				workspaceJSON, err := json.Marshal(workspace)
				if err != nil {
					return nil, err
				}
				return &mcp.CallToolResult{
					Content: []mcp.Content{
						mcp.NewTextContent(fmt.Sprintf("Workspace created!")),
						mcp.NewTextContent(string(workspaceJSON)),
					},
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("execute-command-sync",
				mcp.WithDescription("Execute a command inside of a workspace agent. The output will be returned as text. Useful for short-running commands (generally under a few seconds)."),
				mcp.WithString("workspace-agent-id", mcp.Description("The agent ID of the workspace to connect to."), mcp.Required()),
				mcp.WithString("command", mcp.Description("The command to execute."), mcp.Required()),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				agentID, ok := request.Params.Arguments["workspace-agent-id"].(string)
				if !ok {
					return nil, fmt.Errorf("workspace-agent-id is required")
				}
				command, ok := request.Params.Arguments["command"].(string)
				if !ok {
					return nil, fmt.Errorf("command is required")
				}
				agentConn, err := ensureWorkspaceAgentConn(agentID)
				if err != nil {
					return nil, err
				}
				sshClient, err := ensureSSHClient(agentConn)
				if err != nil {
					return nil, err
				}
				session, err := sshClient.NewSession()
				if err != nil {
					return nil, err
				}
				defer session.Close()

				output, err := session.CombinedOutput(command)
				if err != nil {
					return nil, err
				}
				return &mcp.CallToolResult{
					Content: []mcp.Content{
						mcp.NewTextContent(string(output)),
					},
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("execute-command-async",
				mcp.WithDescription("Execute a long-running command inside of a workspace (useful for things like builds, tests, package installs, or anything that may require user feedback). The command will be executed in the background. The user will expect you to periodically check the output and provide a summary of the output so the user has feedback."),
				mcp.WithString("workspace-agent-id", mcp.Description("The agent ID of the workspace to connect to."), mcp.Required()),
				mcp.WithString("command", mcp.Description("The command to execute."), mcp.Required()),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				agentID, ok := request.Params.Arguments["workspace-agent-id"].(string)
				if !ok {
					return nil, fmt.Errorf("workspace-agent-id is required")
				}
				agentConn, err := ensureWorkspaceAgentConn(agentID)
				if err != nil {
					return nil, err
				}
				sshClient, err := ensureSSHClient(agentConn)
				if err != nil {
					return nil, err
				}
				cmd, err := newCommand(ctx, sshClient, request.Params.Arguments["command"].(string))
				if err != nil {
					return nil, err
				}
				id := uuid.New().String()
				commands[id] = cmd
				return mcp.NewToolResultText(id), nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("async-command-output",
				mcp.WithDescription("Get the output of a command that was executed asynchronously."),
				mcp.WithString("command-id", mcp.Description("The ID of the command to get the output of."), mcp.Required()),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				id, ok := request.Params.Arguments["command-id"].(string)
				if !ok {
					return nil, fmt.Errorf("command-id is required")
				}
				cmd, ok := commands[id]
				if !ok {
					return nil, fmt.Errorf("command not found")
				}
				cmd.mu.Lock()
				defer cmd.mu.Unlock()
				return &mcp.CallToolResult{
					Content: []mcp.Content{mcp.NewTextContent(cmd.output)},
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("async-command-status",
				mcp.WithDescription("Get the status of a command that was executed asynchronously."),
				mcp.WithString("command-id", mcp.Description("The ID of the command to get the status of."), mcp.Required()),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				id, ok := request.Params.Arguments["command-id"].(string)
				if !ok {
					return nil, fmt.Errorf("command-id is required")
				}
				cmd, ok := commands[id]
				if !ok {
					return nil, fmt.Errorf("command not found")
				}
				cmd.mu.Lock()
				defer cmd.mu.Unlock()
				if cmd.err != nil {
					return nil, cmd.err
				}
				if cmd.exitCode == nil {
					return &mcp.CallToolResult{
						Content: []mcp.Content{mcp.NewTextContent("Command is still running...")},
					}, nil
				}
				return &mcp.CallToolResult{
					Content: []mcp.Content{mcp.NewTextContent(fmt.Sprintf("Command %s exited with code %d", id, *cmd.exitCode))},
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("async-command-kill",
				mcp.WithDescription("Kill a command that was executed asynchronously."),
				mcp.WithString("command-id", mcp.Description("The ID of the command to kill."), mcp.Required()),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				id, ok := request.Params.Arguments["command-id"].(string)
				if !ok {
					return nil, fmt.Errorf("command-id is required")
				}
				cmd, ok := commands[id]
				if !ok {
					return nil, fmt.Errorf("command not found")
				}
				cmd.mu.Lock()
				defer cmd.mu.Unlock()
				cmd.session.Close()
				delete(commands, id)
				return &mcp.CallToolResult{
					Content: []mcp.Content{mcp.NewTextContent("Command killed.")},
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("async-command-list",
				mcp.WithDescription("List all commands that have been executed asynchronously."),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				content := []mcp.Content{}
				for id, c := range commands {
					if c.err != nil {
						content = append(content, mcp.NewTextContent(fmt.Sprintf("Command ID: %s (%q) failed: %s", id, c.cmd, c.err)))
					} else if c.exitCode != nil {
						content = append(content, mcp.NewTextContent(fmt.Sprintf("Command ID: %s (%q) exited with code %d", id, c.cmd, *c.exitCode)))
					} else {
						content = append(content, mcp.NewTextContent(fmt.Sprintf("Command ID: %s (%q) is still running...", id, c.cmd)))
					}
				}
				return &mcp.CallToolResult{
					Content: content,
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("start-workspace",
				mcp.WithDescription("Starts a workspace that is currently stopped."),
				mcp.WithString("workspace-id", mcp.Description("The ID of the workspace to start."), mcp.Required()),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				workspaceID, ok := request.Params.Arguments["workspace-id"].(string)
				if !ok {
					return nil, fmt.Errorf("workspace-id is required")
				}
				workspaceUUID, err := uuid.Parse(workspaceID)
				if err != nil {
					return nil, fmt.Errorf("invalid workspace-id: %w", err)
				}
				client, err := client()
				if err != nil {
					return nil, err
				}
				workspace, err := client.CreateWorkspaceBuild(ctx, workspaceUUID, codersdk.CreateWorkspaceBuildRequest{
					Transition: codersdk.WorkspaceTransitionStart,
				})
				if err != nil {
					return nil, err
				}
				workspaceJSON, err := json.Marshal(workspace)
				if err != nil {
					return nil, err
				}
				return &mcp.CallToolResult{
					Content: []mcp.Content{
						mcp.NewTextContent("Workspace start initiated!"),
						mcp.NewTextContent(string(workspaceJSON)),
					},
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("stop-workspace",
				mcp.WithDescription("Stops a running workspace."),
				mcp.WithString("workspace-id", mcp.Description("The ID of the workspace to stop."), mcp.Required()),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				workspaceID, ok := request.Params.Arguments["workspace-id"].(string)
				if !ok {
					return nil, fmt.Errorf("workspace-id is required")
				}
				workspaceUUID, err := uuid.Parse(workspaceID)
				if err != nil {
					return nil, fmt.Errorf("invalid workspace-id: %w", err)
				}
				client, err := client()
				if err != nil {
					return nil, err
				}
				workspace, err := client.CreateWorkspaceBuild(ctx, workspaceUUID, codersdk.CreateWorkspaceBuildRequest{
					Transition: codersdk.WorkspaceTransitionStop,
				})
				if err != nil {
					return nil, err
				}
				workspaceJSON, err := json.Marshal(workspace)
				if err != nil {
					return nil, err
				}
				return &mcp.CallToolResult{
					Content: []mcp.Content{
						mcp.NewTextContent("Workspace stop initiated!"),
						mcp.NewTextContent(string(workspaceJSON)),
					},
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("delete-workspace",
				mcp.WithDescription("Deletes a workspace permanently."),
				mcp.WithString("workspace-id", mcp.Description("The ID of the workspace to delete."), mcp.Required()),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				workspaceID, ok := request.Params.Arguments["workspace-id"].(string)
				if !ok {
					return nil, fmt.Errorf("workspace-id is required")
				}
				workspaceUUID, err := uuid.Parse(workspaceID)
				if err != nil {
					return nil, fmt.Errorf("invalid workspace-id: %w", err)
				}
				client, err := client()
				if err != nil {
					return nil, err
				}
				build, err := client.CreateWorkspaceBuild(ctx, workspaceUUID, codersdk.CreateWorkspaceBuildRequest{
					Transition: codersdk.WorkspaceTransitionDelete,
				})
				if err != nil {
					return nil, err
				}
				buildJSON, err := json.Marshal(build)
				if err != nil {
					return nil, err
				}
				return &mcp.CallToolResult{
					Content: []mcp.Content{
						mcp.NewTextContent("Workspace deleted successfully!"),
						mcp.NewTextContent(string(buildJSON)),
					},
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("start-port-forward",
				mcp.WithDescription("Forward a port from the workspace to the local machine."),
				mcp.WithString("workspace-agent-id", mcp.Description("The ID of the workspace agent to forward the port from."), mcp.Required()),
				mcp.WithNumber("local-port", mcp.Description("The port to listen on locally."), mcp.Required()),
				mcp.WithNumber("remote-port", mcp.Description("The port to forward to the workspace agent."), mcp.Required()),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				workspaceAgentID, ok := request.Params.Arguments["workspace-agent-id"].(string)
				if !ok {
					return nil, fmt.Errorf("workspace-agent-id is required")
				}
				localPort, ok := request.Params.Arguments["local-port"].(float64)
				if !ok {
					return nil, fmt.Errorf("local-port is required: %T", request.Params.Arguments["local-port"])
				}
				remotePort, ok := request.Params.Arguments["remote-port"].(float64)
				if !ok {
					return nil, fmt.Errorf("remote-port is required: %T", request.Params.Arguments["remote-port"])
				}
				agentConn, err := ensureWorkspaceAgentConn(workspaceAgentID)
				if err != nil {
					return nil, err
				}

				// Create a TCP listener on the local port
				listener, err := net.Listen("tcp", fmt.Sprintf("localhost:%d", int(localPort)))
				if err != nil {
					return nil, fmt.Errorf("failed to listen on local port %d: %w", localPort, err)
				}

				// Store the listener for cleanup
				pfMutex.Lock()
				portForwards[int32(localPort)] = listener
				pfMutex.Unlock()

				// Start forwarding in a goroutine
				go func() {
					for {
						conn, err := listener.Accept()
						if err != nil {
							if !strings.Contains(err.Error(), "use of closed network connection") {
								fmt.Printf("Error accepting connection: %v\n", err)
							}
							return
						}

						go func() {
							defer conn.Close()
							remoteAddr := netip.AddrPortFrom(netip.MustParseAddr("127.0.0.1"), uint16(remotePort))
							remoteConn, err := agentConn.Conn.DialContextTCP(ctx, remoteAddr)
							if err != nil {
								// fmt.Printf("Error dialing remote port: %v\n", err)
								return
							}
							defer remoteConn.Close()

							// Copy data bidirectionally
							go io.Copy(conn, remoteConn)
							io.Copy(remoteConn, conn)
						}()
					}
				}()

				return &mcp.CallToolResult{
					Content: []mcp.Content{
						mcp.NewTextContent(fmt.Sprintf("Port forward started: localhost:%d -> workspace:%d", localPort, remotePort)),
					},
				}, nil
			},
		},
		server.ServerTool{
			Tool: mcp.NewTool("stop-port-forward",
				mcp.WithDescription("Stop a port forward."),
				mcp.WithNumber("local-port", mcp.Description("The port to listen on locally."), mcp.Required()),
			),
			Handler: func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				localPort, ok := request.Params.Arguments["local-port"].(float64)
				if !ok {
					return nil, fmt.Errorf("local-port is required")
				}

				pfMutex.Lock()
				listener, exists := portForwards[int32(localPort)]
				if !exists {
					pfMutex.Unlock()
					return nil, fmt.Errorf("no port forward found for local port %d", localPort)
				}

				// Close the listener and remove it from the map
				err := listener.Close()
				delete(portForwards, int32(localPort))
				pfMutex.Unlock()

				if err != nil {
					return nil, fmt.Errorf("failed to close port forward on port %d: %w", localPort, err)
				}

				return &mcp.CallToolResult{
					Content: []mcp.Content{
						mcp.NewTextContent(fmt.Sprintf("Port forward stopped on local port %d", localPort)),
					},
				}, nil
			},
		},
	)

	return srv
}

// extractURIParams extracts all parameters from a URI based on a template pattern
// Returns a map of parameter names to their values
func extractURIParams(uri string, template string) map[string]string {
	params := make(map[string]string)

	// Split both URI and template into protocol and path parts
	uriParts := strings.SplitN(uri, "://", 2)
	templateParts := strings.SplitN(template, "://", 2)

	if len(uriParts) != 2 || len(templateParts) != 2 || uriParts[0] != templateParts[0] {
		return params
	}

	// Split the paths by "/"
	uriPath := strings.Split(uriParts[1], "/")
	templatePath := strings.Split(templateParts[1], "/")

	if len(uriPath) != len(templatePath) {
		return params
	}

	// Match the parameter positions
	for i, part := range templatePath {
		// Check if this part is a parameter placeholder
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			// Extract parameter name without curly braces
			paramName := part[1 : len(part)-1]
			params[paramName] = uriPath[i]
		}
	}

	return params
}

type agentConn struct {
	*workspacesdk.AgentConn
	ssh *ssh.Client
}

type command struct {
	session  *ssh.Session
	cmd      string
	output   string
	exitCode *int
	stdin    io.WriteCloser
	err      error

	mu sync.Mutex
}

func (c *command) start(ctx context.Context, command string) error {
	c.cmd = command

	stdout, err := c.session.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := c.session.StderrPipe()
	if err != nil {
		return err
	}
	stdin, err := c.session.StdinPipe()
	if err != nil {
		return err
	}
	c.stdin = stdin
	err = c.session.Start(command)
	if err != nil {
		return err
	}

	go func() {
		buffer := make([]byte, 4096)
		for {
			n, err := stdout.Read(buffer)
			if err != nil {
				return
			}
			if n > 0 {
				c.mu.Lock()
				c.output += string(buffer[:n])
				c.mu.Unlock()
			}
		}
	}()
	go func() {
		buffer := make([]byte, 4096)
		for {
			n, err := stderr.Read(buffer)
			if err != nil {
				return
			}
			if n > 0 {
				c.mu.Lock()
				c.output += string(buffer[:n])
				c.mu.Unlock()
			}
		}
	}()
	go func() {
		err := c.session.Wait()
		exitCode := 0
		if err != nil {
			exitErr, ok := err.(*ssh.ExitError)
			if !ok {
				c.mu.Lock()
				exitCode = exitErr.ExitStatus()
				c.exitCode = &exitCode
				c.mu.Unlock()
				return
			}
			c.mu.Lock()
			c.err = err
			c.mu.Unlock()
			return
		}
		c.mu.Lock()
		c.err = nil
		c.exitCode = &exitCode
		c.mu.Unlock()
	}()

	return nil
}

func newCommand(ctx context.Context, client *ssh.Client, cmd string) (*command, error) {
	session, err := client.NewSession()
	if err != nil {
		return nil, err
	}
	c := &command{
		session: session,
	}
	return c, c.start(ctx, cmd)
}

func tryValue[T any](params map[string]interface{}, key string) T {
	var zero T
	v, ok := params[key]
	if !ok {
		return zero
	}

	// Type assert based on the generic type
	switch any(zero).(type) {
	case string:
		if str, ok := v.(string); ok {
			return any(str).(T)
		}
	case int:
		switch n := v.(type) {
		case int:
			return any(n).(T)
		case float64:
			return any(int(n)).(T)
		}
	case float64:
		switch n := v.(type) {
		case float64:
			return any(n).(T)
		case int:
			return any(float64(n)).(T)
		}
	}

	return zero
}
