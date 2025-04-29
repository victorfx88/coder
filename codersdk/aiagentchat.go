package codersdk

import (
	"time"

	"github.com/google/uuid"

	"github.com/coder/coder/v2/coderd/aiagentsdk"
)

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
