package coderd

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"

	"github.com/google/uuid"

	"github.com/coder/coder/v2/coderd/database"
	"github.com/coder/coder/v2/coderd/database/dbtime"
	"github.com/coder/coder/v2/coderd/httpapi"
	"github.com/coder/coder/v2/coderd/httpmw"
	"github.com/coder/coder/v2/coderd/rbac"
	"github.com/coder/coder/v2/codersdk"
)

// TODO: @Summary Update notifications settings
// TODO: @ID update-notifications-settings
// TODO: @Security CoderSessionToken
// TODO: @Accept json
// TODO: @Produce json
// TODO: @Tags Notifications
// TODO: @Param request body codersdk.NotificationsSettings true "Notifications settings request"
// TODO: @Success 200 {object} codersdk.NotificationsSettings
// TODO: @Success 304
// TODO: @Router /notifications/settings [put]
func (api *API) postResourcePools(rw http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	apiKey := httpmw.APIKey(r)
	org := httpmw.OrganizationParam(r)

	var poolReq codersdk.ResourcePoolRequest
	if !httpapi.Read(ctx, rw, r, &poolReq) {
		return
	}

	template, err := base64.StdEncoding.DecodeString(poolReq.Template)
	if len(template) <= 1 {
		httpapi.Write(ctx, rw, http.StatusBadRequest, "given template is empty")
		return
	}

	if err != nil {
		httpapi.InternalServerError(rw, fmt.Errorf("decode template base64 error: %w", err))
		return
	}

	hashBytes := sha256.Sum256(template)
	hash := hex.EncodeToString(hashBytes[:])
	// TODO: template as zip with .terraform.lock.hcl etc?
	tmplFile, err := api.Database.InsertFile(ctx, database.InsertFileParams{
		ID:        uuid.New(),
		Hash:      hash,
		CreatedAt: dbtime.Now(),
		CreatedBy: apiKey.UserID,
		Mimetype:  "application/x-terraform", // TODO: ?
		Data:      template,
	})
	if err != nil {
		httpapi.InternalServerError(rw, fmt.Errorf("insert file error: %w", err))
		return
	}

	pool, err := api.Database.InsertResourcePool(ctx, database.InsertResourcePoolParams{
		ID:             uuid.New(),
		Name:           poolReq.Name,
		Capacity:       poolReq.Capacity,
		TemplateFileID: tmplFile.ID,
		UserID:         apiKey.UserID,
		OrganizationID: org.ID,
	})
	if err != nil {
		if rbac.IsUnauthorizedError(err) {
			httpapi.Forbidden(rw)
			return
		}
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Failed to update notifications settings.",
			Detail:  err.Error(),
		})

		return
	}

	httpapi.Write(r.Context(), rw, http.StatusOK, pool.ID)
}
