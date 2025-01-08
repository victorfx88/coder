package coderd

import (
	"fmt"
	"github.com/coder/coder/v2/coderd/httpapi"
	"github.com/coder/coder/v2/codersdk"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"net/http"
)

func (api *API) fetchTfsecViolations(rw http.ResponseWriter, r *http.Request) {
	var (
		ctx   = r.Context()
		jobID = chi.URLParam(r, "jobID")
	)

	jobUUID, err := uuid.Parse(jobID)
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusBadRequest, codersdk.Response{
			Message: fmt.Sprintf("Job ID %q must be a valid UUID.", jobID),
			Detail:  err.Error(),
		})
		return
	}

	violations, err := api.Database.GetTfsecViolations(ctx, jobUUID)
	if httpapi.Is404Error(err) {
		httpapi.Write(ctx, rw, http.StatusNotFound, codersdk.Response{
			Message: fmt.Sprintf("Violations from job %q not found.", jobUUID),
		})
		return
	}
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Internal error fetching violations.",
			Detail:  err.Error(),
		})
		return
	}

	httpapi.Write(ctx, rw, http.StatusOK, violations)
}
