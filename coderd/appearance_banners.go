package coderd

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"golang.org/x/xerrors"

	"github.com/coder/coder/v2/coderd/httpapi"
	"github.com/coder/coder/v2/codersdk"
)

// dismissAnnouncementBannerRequest is the request body for dismissing an announcement banner.
type dismissAnnouncementBannerRequest struct {
	Message string `json:"message"`
}

// dismissAnnouncementBanner handles dismissing an announcement banner for the current user.
func (api *API) dismissAnnouncementBanner(rw http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	apiKey := httpapi.APIKey(r)

	var req dismissAnnouncementBannerRequest
	if !httpapi.Read(ctx, rw, r, &req) {
		return
	}

	if req.Message == "" {
		httpapi.Write(ctx, rw, http.StatusBadRequest, codersdk.Response{
			Message: "Message is required",
			Validations: []codersdk.ValidationError{
				{
					Field:  "message",
					Detail: "This field is required",
				},
			},
		})
		return
	}

	if api.BannerDismisser == nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Banner dismissal is not configured",
		})
		return
	}

	err := api.BannerDismisser.DismissBanner(ctx, apiKey.UserID.String(), req.Message)
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Failed to dismiss banner",
			Detail:  err.Error(),
		})
		return
	}

	httpapi.Write(ctx, rw, http.StatusOK, codersdk.Response{
		Message: "Banner dismissed",
	})
}

// Configure banner routes.
func (api *API) configureAppearanceBannerRoutes(r chi.Router) {
	r.Post("/dismiss", api.dismissAnnouncementBanner)
}