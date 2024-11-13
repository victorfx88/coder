package coderd

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"

	"cdr.dev/slog"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
	"golang.org/x/xerrors"

	"github.com/coder/coder/v2/coderd/database"
	"github.com/coder/coder/v2/coderd/database/dbtime"
	"github.com/coder/coder/v2/coderd/database/provisionerjobs"
	"github.com/coder/coder/v2/coderd/httpapi"
	"github.com/coder/coder/v2/coderd/httpmw"
	"github.com/coder/coder/v2/coderd/provisionerdserver"
	"github.com/coder/coder/v2/coderd/rbac"
	"github.com/coder/coder/v2/coderd/tracing"
	"github.com/coder/coder/v2/codersdk"
	"github.com/coder/coder/v2/provisionersdk"
	"github.com/coder/coder/v2/provisionersdk/proto"
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

	logger := api.Logger.With(slog.F("component", "resoucepools"))

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

	// TODO: hack for now
	hashBytes := sha256.Sum256(append([]byte(poolReq.Name), template...))
	hash := hex.EncodeToString(hashBytes[:])

	var (
		pool database.ResourcePool
		job  database.ProvisionerJob
	)
	err = api.Database.InTx(func(tx database.Store) error {
		tmplFile, err := tx.InsertFile(ctx, database.InsertFileParams{
			ID:        uuid.New(),
			Hash:      hash,
			CreatedAt: dbtime.Now(),
			CreatedBy: apiKey.UserID,
			Mimetype:  http.DetectContentType(template), // TODO: align with how workspace template is uploaded
			Data:      template,
		})
		if err != nil {
			return xerrors.Errorf("insert resource pool template file: %w", err)
		}

		logger.Debug(ctx, "template file created", slog.F("file_id", tmplFile.ID))

		pool, err = tx.InsertResourcePool(ctx, database.InsertResourcePoolParams{
			ID:             uuid.New(),
			Name:           poolReq.Name,
			Capacity:       poolReq.Capacity,
			TemplateFileID: tmplFile.ID,
			UserID:         apiKey.UserID,
			OrganizationID: org.ID,
		})
		if err != nil {
			return xerrors.Errorf("insert resource pool: %w", err)
		}

		logger.Info(ctx, "resource pool created", slog.F("pool_id", pool.ID))

		jobInput, err := json.Marshal(provisionerdserver.ResourcePoolBuildJob{
			PoolID:     pool.ID,
			PoolName:   pool.Name,
			Transition: proto.ResourcePoolEntryTransition_ALLOCATE,
		})

		tags := provisionersdk.MutateTags(apiKey.UserID, map[string]string{
			// TODO: what tags should be applied?
		})

		traceMetadataRaw, err := json.Marshal(tracing.MetadataFromContext(ctx))
		if err != nil {
			httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
				Message: "Internal error creating resource pool entries.",
				Detail:  xerrors.Errorf("marshal job metadata: %w", err).Error(),
			})
			return err
		}

		job, err = tx.InsertProvisionerJob(ctx, database.InsertProvisionerJobParams{
			ID:             uuid.New(),
			CreatedAt:      dbtime.Now(),
			UpdatedAt:      dbtime.Now(),
			OrganizationID: org.ID,
			InitiatorID:    apiKey.UserID,
			Provisioner:    database.ProvisionerTypeTerraform, // TODO: dynamic
			StorageMethod:  database.ProvisionerStorageMethodFile,
			FileID:         tmplFile.ID,
			Type:           database.ProvisionerJobTypeResourcePoolEntryBuild,
			Input:          jobInput,
			Tags:           tags,
			TraceMetadata: pqtype.NullRawMessage{
				RawMessage: traceMetadataRaw,
				Valid:      true,
			},
		})
		if err != nil {
			return xerrors.Errorf("insert provisioner job: %w", err)
		}
		logger.Debug(ctx, "provisioner job created", slog.F("job_id", job.ID))

		err = provisionerjobs.PostJob(api.Pubsub, job)
		if err != nil {
			// Client probably doesn't care about this error, so just log it.
			logger.Error(ctx, "failed to post provisioner job to pubsub", slog.Error(err))
		}

		logger.Debug(ctx, "posted provisioner job to pubsub", slog.F("job_id", job.ID))

		return nil
	}, nil)

	if err != nil {
		logger.Error(ctx, "resource pool tx rolled back", slog.Error(err))

		if rbac.IsUnauthorizedError(err) {
			httpapi.Forbidden(rw)
			return
		}
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Failed to create resource pool.",
			Detail:  err.Error(),
		})

		return
	}

	httpapi.Write(r.Context(), rw, http.StatusOK, pool.ID)
}
