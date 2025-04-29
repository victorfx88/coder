package coderd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"sync"

	"github.com/google/uuid"
	"github.com/tmaxmax/go-sse"
	"golang.org/x/xerrors"

	"cdr.dev/slog"

	"github.com/coder/coder/v2/coderd/aiagentsdk"
	"github.com/coder/coder/v2/coderd/httpapi"
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
