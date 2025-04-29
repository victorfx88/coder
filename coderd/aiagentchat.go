package coderd

import (
	"context"
	"encoding/json"
	"net"
	"net/http"

	"github.com/google/uuid"
	"github.com/tmaxmax/go-sse"
	"golang.org/x/xerrors"

	"cdr.dev/slog"

	"github.com/coder/coder/v2/coderd/aiagentsdk"
	"github.com/coder/coder/v2/coderd/httpapi"
	"github.com/coder/coder/v2/codersdk"
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

// @Summary Watch for workspace agent metadata updates
// @ID watch-for-workspace-agent-metadata-updates
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
	aiAgentConn, cleanup, err := getAIAgentHTTPConn(ctx, api, theChat.WorkspaceAgentID, theChat.Address)
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Internal error dialing workspace agent.",
			Detail:  err.Error(),
		})
		return
	}
	defer cleanup()
	// TODO: remove the http:// prefix. not sure if it's needed.
	aiAgentClient, err := aiagentsdk.NewClient("http://"+theChat.Address, aiagentsdk.WithHTTPClient(aiAgentConn))
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Internal error creating AI Agent client.",
			Detail:  err.Error(),
		})
		return
	}

	resp, err := aiAgentClient.SubscribeEvents(ctx)
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Internal error subscribing to AI Agent events.",
			Detail:  err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	sendEvent, senderClosed, err := httpapi.OneWayWebSocketEventSender(rw, r)
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Internal error setting up server-sent events.",
			Detail:  err.Error(),
		})
		return
	}
	// If you look at the other uses of OneWayWebSocketEventSender, you'll see
	// that they always block the function from returning until the sender is
	// closed. However, as far as I can tell, there's no way for the caller of
	// OneWayWebSocketEventSender to close the sender. We'd like to do it in case
	// the AI agent stops responding. OneWayWebSocketEventSender uses the request
	// context, so I think it should finish when the request is done.
	// TODO: verify with the author of OneWayWebSocketEventSender before merging.
	go func() {
		select {
		case <-ctx.Done():
		case <-senderClosed:
			cancel()
		}
		api.Logger.Info(ctx, "ai agent chat closed by context")
	}()

	// A message update may be as large as 80,000 bytes if the entire
	// screen is filled with text.
	readCfg := &sse.ReadConfig{
		MaxEventSize: 1024 * 128, // 128KB
	}
	for ev, err := range sse.Read(resp.Body, readCfg) {
		if err != nil {
			_ = sendEvent(codersdk.ServerSentEvent{
				Type: codersdk.ServerSentEventTypeError,
				Data: err.Error(),
			})
			// TODO: remove this error log before merging
			api.Logger.Error(ctx, "error reading AI Agent event", slog.Error(err))
			return
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
			_ = sendEvent(codersdk.ServerSentEvent{
				Type: codersdk.ServerSentEventTypeError,
				Data: err.Error(),
			})
			return
		}
		var dataWithType struct {
			Type  string `json:"type"`
			Event any    `json:"event"`
		}
		dataWithType.Type = ev.Type
		dataWithType.Event = eventData
		_ = sendEvent(codersdk.ServerSentEvent{
			Type: codersdk.ServerSentEventTypeData,
			Data: dataWithType,
		})
	}
}
