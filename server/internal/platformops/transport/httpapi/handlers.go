package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	platformhttp "nido/server/internal/platform/httpapi"
	app "nido/server/internal/platformops/application"
	platformopsdomain "nido/server/internal/platformops/domain"
)

func Register(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, service *app.Service) {
	mux.Handle("GET /api/v1/backoffice/platform/settings", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		settings, err := service.GetSettings(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": settings})
	})))

	mux.Handle("PUT /api/v1/backoffice/platform/settings", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request platformopsdomain.PlatformSettings
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		request.Webhook.URL = app.NormalizeWebhookURL(request.Webhook.URL)
		request.Slack.URL = app.NormalizeWebhookURL(request.Slack.URL)
		request.Spreadsheet.URL = app.NormalizeWebhookURL(request.Spreadsheet.URL)
		request.TaskSystem.URL = app.NormalizeWebhookURL(request.TaskSystem.URL)
		settings, err := service.UpdateSettings(r.Context(), request)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": settings})
	})))

	mux.Handle("GET /api/v1/backoffice/platform/summary", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		summary, err := service.Summary(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": summary})
	})))

	mux.Handle("GET /api/v1/backoffice/platform/deliveries", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limit, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("limit")))
		logs, err := service.ListDeliveryLogs(r.Context(), limit)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": logs, "count": len(logs)})
	})))

	mux.Handle("POST /api/v1/backoffice/platform/test/{channel}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		channel := strings.TrimSpace(r.PathValue("channel"))
		if channel == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "channel is required")
			return
		}
		if err := service.TestChannel(r.Context(), channel); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})))
}
