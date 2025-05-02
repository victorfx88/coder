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

// AIAgentList represents a list of AI agents.
type AIAgentList struct {
	// Agents is a list of AI agents.
	Agents []AIAgent `json:"agents"`
}

// AIAgent represents a single AI agent.
type AIAgent struct {
	// DisplayName is the display name of the AI agent.
	DisplayName string `json:"display_name"`
	// Icon is the icon of the AI agent.
	Icon string `json:"icon"`
	// WorkspaceName is the name of the workspace.
	WorkspaceName string `json:"workspace_name"`
	// WorkspaceAgentID is the ID of the workspace agent.
	WorkspaceAgentID uuid.UUID `json:"workspace_agent_id"`
	// AgentAPIPort is the port number on which the agent API is available.
	AgentAPIPort int `json:"agentapi_port"`
}
