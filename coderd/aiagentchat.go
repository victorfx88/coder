package coderd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"regexp"
	"strconv"
	"sync"

	"github.com/google/uuid"
	"github.com/tmaxmax/go-sse"
	"golang.org/x/xerrors"

	"cdr.dev/slog"

	"github.com/coder/coder/v2/coderd/aiagentsdk"
	"github.com/coder/coder/v2/coderd/database"
	"github.com/coder/coder/v2/coderd/httpapi"
	"github.com/coder/coder/v2/coderd/httpmw"
	"github.com/coder/coder/v2/coderd/rbac"
	"github.com/coder/coder/v2/coderd/rbac/policy"
	"github.com/coder/coder/v2/codersdk"
	"github.com/coder/websocket"
)

var theChat = codersdk.AIAgentChat{
	ID:               uuid.MustParse("a62af7f4-5e48-43a2-a906-bd0763a2926f"),
	WorkspaceAgentID: uuid.MustParse("1b0ca41e-6f38-4b97-bfcc-745d235d294c"),
	Address:          "127.0.0.1:3284",
}

func getAIAgentHTTPConn(ctx context.Context, api *API, agentID uuid.UUID, address string) (*http.Client, func(), error) {
	var err error
	closeFns := []func(){}
	cleanup := func() {
		for i := len(closeFns) - 1; i >= 0; i-- {
			closeFns[i]()
		}
	}
	defer func() {
		if err != nil {
			cleanup()
		}
	}()

	agentConn, release, err := api.agentProvider.AgentConn(ctx, agentID)
	if err != nil {
		err = xerrors.Errorf("get agent conn: %w", err)
		return nil, nil, err
	}
	closeFns = append(closeFns, release)

	// Establish a TCP connection to the port on the agent
	conn, err := agentConn.DialContext(ctx, "tcp", address)
	if err != nil {
		err = xerrors.Errorf("dial address %s: %w", address, err)
		return nil, nil, err
	}
	closeFns = append(closeFns, func() {
		conn.Close()
	})

	// Create an HTTP client that uses our connection
	httpConn := &http.Client{
		Transport: &http.Transport{
			DialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
				return conn, nil
			},
		},
	}
	return httpConn, cleanup, nil
}

func NewAIAgentClient(ctx context.Context, api *API, agentID uuid.UUID, address string) (*aiagentsdk.Client, func(), error) {
	aiAgentConn, cleanup, err := getAIAgentHTTPConn(ctx, api, agentID, address)
	if err != nil {
		defer cleanup()
		return nil, nil, err
	}
	// TODO: remove the http:// prefix. not sure if it's needed.
	aiAgentClient, err := aiagentsdk.NewClient("http://"+address, aiagentsdk.WithHTTPClient(aiAgentConn))
	if err != nil {
		defer cleanup()
		return nil, nil, err
	}
	return aiAgentClient, cleanup, nil
}

// parseAgentAPIPort extracts the port number from an app slug ending with "-agentapi-${port}"
func parseAgentAPIPort(slug string) (int, bool) {
	// Look for a pattern like "-agentapi-12345" at the end of the slug
	pattern := regexp.MustCompile(`-agentapi-(\d+)$`)
	matches := pattern.FindStringSubmatch(slug)

	if len(matches) < 2 {
		return 0, false
	}

	port, err := strconv.Atoi(matches[1])
	if err != nil {
		return 0, false
	}

	return port, true
}

// @Summary List all running AI agents
// @ID list-ai-agents
// @Security CoderSessionToken
// @Tags AI Agent Chat
// @Success 200 {object} codersdk.AIAgentList
// @Router /aiagent/chats [get]
func (api *API) listAIAgents(rw http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	apiKey := httpmw.APIKey(r)

	// Create the filter for authorized workspaces
	prepared, err := api.HTTPAuth.AuthorizeSQLFilter(r, policy.ActionRead, rbac.ResourceWorkspace.Type)
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Internal error preparing sql filter.",
			Detail:  err.Error(),
		})
		return
	}

	// Get all workspaces the user has access to
	workspaces, err := api.Database.GetAuthorizedWorkspaces(ctx, database.GetWorkspacesParams{
		RequesterID: apiKey.UserID,
	}, prepared)
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Internal error fetching workspaces.",
			Detail:  err.Error(),
		})
		return
	}

	var allAgents []database.WorkspaceAgent
	var agentIDs []uuid.UUID

	var workspacesByAgentID map[uuid.UUID]database.GetWorkspacesRow = make(map[uuid.UUID]database.GetWorkspacesRow)
	// For each workspace, get agents in the latest build
	for _, workspace := range workspaces {
		agents, err := api.Database.GetWorkspaceAgentsInLatestBuildByWorkspaceID(ctx, workspace.ID)
		if err != nil {
			// Skip workspaces with errors
			api.Logger.Debug(ctx, "failed to get workspace agents in latest build",
				slog.F("workspace_id", workspace.ID),
				slog.Error(err))
			continue
		}

		// Only include connected agents
		for _, agent := range agents {
			if agent.Status(api.Options.AgentInactiveDisconnectTimeout).Status == database.WorkspaceAgentStatusConnected {
				allAgents = append(allAgents, agent)
				agentIDs = append(agentIDs, agent.ID)
				workspacesByAgentID[agent.ID] = workspace
			}
		}
	}

	if len(agentIDs) == 0 {
		// No running agents found, return empty list
		httpapi.Write(ctx, rw, http.StatusOK, codersdk.AIAgentList{
			Agents: []codersdk.AIAgent{},
		})
		return
	}

	// Get all workspace apps for the running agents
	workspaceApps, err := api.Database.GetWorkspaceAppsByAgentIDs(ctx, agentIDs)
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Internal error fetching workspace apps.",
			Detail:  err.Error(),
		})
		return
	}

	// Create a map to easily look up agent by ID
	agentsByID := make(map[uuid.UUID]database.WorkspaceAgent, len(allAgents))
	for _, agent := range allAgents {
		agentsByID[agent.ID] = agent
	}

	// Filter apps whose slug ends with "-agentapi-${port}" and extract the port number
	var aiAgents []codersdk.AIAgent = make([]codersdk.AIAgent, 0)
	for _, app := range workspaceApps {
		port, isAgentAPI := parseAgentAPIPort(app.Slug)
		if !isAgentAPI {
			continue
		}

		// Add to result
		aiAgents = append(aiAgents, codersdk.AIAgent{
			DisplayName:      app.DisplayName,
			Icon:             app.Icon,
			WorkspaceAgentID: app.AgentID,
			AgentAPIPort:     port,
			WorkspaceName:    workspacesByAgentID[app.AgentID].Name,
		})
	}

	httpapi.Write(ctx, rw, http.StatusOK, codersdk.AIAgentList{
		Agents: aiAgents,
	})
}

// @Summary Watch for workspace agent metadata updates
// @ID watch-ai-agent-chat
// @Security CoderSessionToken
// @Tags AI Agent Chat
// @Success 200 "Success"
// @Param aiagentchat path string true "AI Agent Chat ID" format(uuid)
// @Router /aiagent/chats/{aiagentchat}/watch [get]
// @x-apidocgen {"skip": true}
func (api *API) watchAIAgentChat(rw http.ResponseWriter, r *http.Request) {
	// Allow us to interrupt watch via cancel.
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	aiAgentClient, cleanup, err := NewAIAgentClient(ctx, api, theChat.WorkspaceAgentID, theChat.Address)
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Internal error creating AI Agent client.",
			Detail:  err.Error(),
		})
		return
	}
	defer cleanup()
	aiAgentChatClientTmp, cleanup2, err := NewAIAgentClient(ctx, api, theChat.WorkspaceAgentID, theChat.Address)
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Internal error creating AI Agent chat client.",
			Detail:  err.Error(),
		})
		return
	}
	defer cleanup2()
	aiAgentChatClient := aiagentsdk.ClientWithResponses{ClientInterface: aiAgentChatClientTmp}

	resp, err := aiAgentClient.SubscribeEvents(ctx)
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Internal error subscribing to AI Agent events.",
			Detail:  err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	// Create bidirectional websocket connection
	conn, err := websocket.Accept(rw, r, nil)
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Failed to accept websocket connection.",
			Detail:  err.Error(),
		})
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "Connection closed")

	sendMessage := func(event codersdk.ServerSentEvent) error {
		messageData, err := json.Marshal(event)
		if err != nil {
			return err
		}
		return conn.Write(ctx, websocket.MessageText, messageData)
	}

	reportError := func(err string) {
		errData, _ := json.Marshal(codersdk.ServerSentEvent{
			Type: codersdk.ServerSentEventTypeError,
			Data: err,
		})
		_ = conn.Write(ctx, websocket.MessageText, errData)
	}

	wg := sync.WaitGroup{}

	listenCtx, listenCancel := context.WithCancel(ctx)

	// Start goroutine to listen for client messages
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-listenCtx.Done():
				return
			default:
				messageType, message, err := conn.Read(listenCtx)
				if err != nil {
					if listenCtx.Err() != nil || errors.Is(err, context.Canceled) {
						return
					}
					api.Logger.Error(listenCtx, "error reading from websocket", slog.Error(err))
					return
				}

				var clientMessage codersdk.AIAgentChatClientMessage
				if messageType != websocket.MessageText {
					reportError("Invalid message type: expected text")
					continue
				}

				err = json.Unmarshal(message, &clientMessage)
				if err != nil {
					reportError(fmt.Sprintf("Invalid message format: %s", err.Error()))
					continue
				}

				// TODO: handle all the send errors
				aiAgentRes, err := aiAgentChatClient.PostMessageWithResponse(ctx, clientMessage.Body)
				if err != nil {
					_ = sendMessage(codersdk.ServerSentEvent{
						Type: codersdk.ServerSentEventTypeError,
						Data: codersdk.AIAgentChatClientResponse{
							ID:     clientMessage.ID,
							Ok:     false,
							Detail: err.Error(),
						},
					})
					continue
				}
				if aiAgentRes.StatusCode() != http.StatusOK {
					// TODO: format the error better
					errData, _ := json.Marshal(aiAgentRes.ApplicationproblemJSONDefault)
					_ = sendMessage(codersdk.ServerSentEvent{
						Type: codersdk.ServerSentEventTypeError,
						Data: codersdk.AIAgentChatClientResponse{
							ID:     clientMessage.ID,
							Ok:     false,
							Detail: string(errData),
						},
					})
					continue
				}

				_ = sendMessage(codersdk.ServerSentEvent{
					Type: codersdk.ServerSentEventTypeData,
					Data: codersdk.AIAgentChatClientResponse{
						ID: clientMessage.ID,
						Ok: true,
					},
				})
			}
		}
	}()

	// A message update may be as large as 80,000 bytes if the agent's
	// response takes up the entire terminal screen.
	readCfg := &sse.ReadConfig{
		MaxEventSize: 1024 * 128, // 128KB
	}

	// Process SSE events and forward them to the client
	for ev, err := range sse.Read(resp.Body, readCfg) {
		if err != nil {
			if ctx.Err() != nil || errors.Is(err, context.Canceled) {
				break
			}
			if errors.Is(err, io.EOF) {
				break
			}
			api.Logger.Error(ctx, "error reading AI Agent event", slog.Error(err))

			// Send error as a message to the websocket
			errData, _ := json.Marshal(codersdk.ServerSentEvent{
				Type: codersdk.ServerSentEventTypeError,
				Data: err.Error(),
			})
			_ = conn.Write(ctx, websocket.MessageText, errData)
			break
		}

		var eventData any
		if ev.Type == "message_update" {
			eventData = aiagentsdk.MessageUpdateBody{}
		} else if ev.Type == "status_change" {
			eventData = aiagentsdk.StatusChangeBody{}
		}
		err = json.Unmarshal([]byte(ev.Data), &eventData)
		if err != nil {
			api.Logger.Error(ctx, "error unmarshalling message update", slog.Error(err))
			errData, _ := json.Marshal(codersdk.ServerSentEvent{
				Type: codersdk.ServerSentEventTypeError,
				Data: err.Error(),
			})
			_ = conn.Write(ctx, websocket.MessageText, errData)
			break
		}

		var dataWithType struct {
			Type  string `json:"type"`
			Event any    `json:"event"`
		}
		dataWithType.Type = ev.Type
		dataWithType.Event = eventData

		// Send event to websocket
		messageData, err := json.Marshal(codersdk.ServerSentEvent{
			Type: codersdk.ServerSentEventTypeData,
			Data: dataWithType,
		})
		if err != nil {
			api.Logger.Error(ctx, "error marshaling event", slog.Error(err))
			break
		}
		err = conn.Write(ctx, websocket.MessageText, messageData)
		if err != nil {
			api.Logger.Error(ctx, "error writing to websocket", slog.Error(err))
			break
		}
	}

	// Signal the listener goroutine to exit
	listenCancel()
	wg.Wait()
}
