package codersdk

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"golang.org/x/xerrors"
	"net/http"
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

type CreateResourcePoolRequest struct {
	Name     string `json:"name"`
	Template string `json:"template"`
	Capacity int    `json:"capacity"`
}

func (c *Client) CreateResourcePool(ctx context.Context, org string, req CreateResourcePoolRequest) (uuid.UUID, error) {
	req.Template = base64.StdEncoding.EncodeToString([]byte(req.Template))

	res, err := c.Request(ctx, http.MethodPost, fmt.Sprintf("/api/v2/organizations/%s/resourcepools", org), req)
	if err != nil {
		return uuid.Nil, xerrors.Errorf("execute request: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return uuid.Nil, ReadBodyAsError(res)
	}

	var id string
	err = json.NewDecoder(res.Body).Decode(&id)
	if err != nil {
		return uuid.Nil, xerrors.Errorf("decode body: %w", err)
	}
	return uuid.Parse(id)
}
