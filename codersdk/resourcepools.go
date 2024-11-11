package codersdk

import (
	"time"

	"github.com/google/uuid"
)

type ResourcePool struct {
	ID             uuid.UUID `json:"id" format:"uuid"`
	Name           string    `json:"name"`
	Capacity       int32     `json:"capacity"`
	TemplateFileID uuid.UUID `json:"template_file_id" format:"uuid"`
	UserID         uuid.UUID `json:"userID" format:"uuid"`
	OrganizationID uuid.UUID `json:"organization_id" format:"uuid"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type ResourcePoolClaim struct {
	ID                  uuid.UUID `json:"id" format:"uuid"`
	ResourcePoolEntryID uuid.UUID `json:"resource_pool_entry_id" format:"uuid"`
	UserID              uuid.UUID `json:"user_id" format:"uuid"`
	WorkspaceID         uuid.UUID `json:"workspace_id" format:"uuid"`
}

type ResourcePoolEntry struct {
	ID        uuid.UUID `json:"id" format:"uuid"`
	Reference string    `json:"reference"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ResourcePoolRequest struct {
	Name     string `json:"name"`
	Capacity int32  `json:"capacity"`
	Template string `json:"template"`
}
