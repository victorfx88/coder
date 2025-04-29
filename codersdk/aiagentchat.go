package codersdk

import (
	"time"

	"github.com/google/uuid"

	"github.com/coder/coder/v2/coderd/aiagentsdk"
)

type AIAgentChatClientMessage struct {
	ID   int                           `json:"id"`
	Body aiagentsdk.MessageRequestBody `json:"body"`
}

type AIAgentChatClientResponse struct {
	ID     int    `json:"id"`
	Ok     bool   `json:"ok"`
	Detail string `json:"detail"`
}

type AIAgentChat struct {
	ID               uuid.UUID `json:"id"`
	WorkspaceAgentID uuid.UUID `json:"workspace_agent_id"`
	Address          string    `json:"address"`
}

type AIAgentChatMessage struct {
	ID        int                         `json:"id"`
	CreatedAt time.Time                   `json:"created_at"`
	Role      aiagentsdk.ConversationRole `json:"role"`
	Content   string                      `json:"content"`
}
