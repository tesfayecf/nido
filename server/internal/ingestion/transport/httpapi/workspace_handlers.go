package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	authhttp "home-searcher/server/internal/auth/transport/httpapi"
	ingestionapp "home-searcher/server/internal/ingestion/application"
	ingestiondomain "home-searcher/server/internal/ingestion/domain"
	platformhttp "home-searcher/server/internal/platform/httpapi"
)

// RegisterWorkspace binds property-context, analytics, portability, and operations routes.
func RegisterWorkspace(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, service *ingestionapp.WorkspaceService) {
	mux.Handle("GET /api/v1/backoffice/properties/{propertyID}/metadata", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		metadata, err := service.GetPropertyMetadata(r.Context(), propertyID)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": metadata})
	})))

	mux.Handle("PUT /api/v1/backoffice/properties/{propertyID}/metadata", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		var metadata ingestiondomain.PropertyMetadata
		if err := json.NewDecoder(r.Body).Decode(&metadata); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		metadata.PropertyID = strings.TrimSpace(r.PathValue("propertyID"))
		saved, err := service.UpdatePropertyMetadata(r.Context(), principal.User, metadata)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": saved})
	})))

	mux.Handle("GET /api/v1/backoffice/properties/{propertyID}/audit", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		entries, err := service.ListAuditLogs(r.Context(), "property", strings.TrimSpace(r.PathValue("propertyID")), platformhttp.ParseLimit(r.URL.Query().Get("limit")))
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": entries, "count": len(entries)})
	})))

	mux.Handle("POST /api/v1/backoffice/properties/import/preview", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reader, err := readCSVInput(r)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		preview, err := service.PreviewCSVImport(reader)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": preview})
	})))

	mux.Handle("POST /api/v1/backoffice/properties/import", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		reader, err := readCSVInput(r)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		preview, err := service.ImportCSVProperties(r.Context(), principal.User, reader)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusCreated, map[string]any{"item": preview})
	})))

	mux.Handle("GET /api/v1/backoffice/properties/export", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, err := service.ExportPropertiesCSV(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", `attachment; filename="properties-export.csv"`)
		_, _ = w.Write(payload)
	})))

	mux.Handle("GET /api/v1/backoffice/analytics/portfolio", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		filter := map[string]string{
			"priority":        strings.TrimSpace(r.URL.Query().Get("priority")),
			"source":          strings.TrimSpace(r.URL.Query().Get("source")),
			"tag":             strings.TrimSpace(r.URL.Query().Get("tag")),
			"time_range_days": strings.TrimSpace(r.URL.Query().Get("time_range_days")),
		}
		analytics, err := service.BuildPortfolioAnalytics(r.Context(), filter)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": analytics})
	})))

	mux.Handle("GET /api/v1/backoffice/integrations", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		integrations, err := service.ListIntegrations(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": integrations, "count": len(integrations)})
	})))

	mux.Handle("POST /api/v1/backoffice/integrations", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		var config ingestiondomain.IntegrationConfig
		if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		saved, err := service.SaveIntegration(r.Context(), principal.User, config)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusCreated, map[string]any{"item": saved})
	})))

	mux.Handle("POST /api/v1/backoffice/integrations/{integrationID}/test", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		delivery, err := service.TestIntegration(r.Context(), principal.User, strings.TrimSpace(r.PathValue("integrationID")))
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": delivery})
	})))

	mux.Handle("GET /api/v1/backoffice/integration-deliveries", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		deliveries, err := service.ListIntegrationDeliveries(r.Context(), platformhttp.ParseLimit(r.URL.Query().Get("limit")))
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": deliveries, "count": len(deliveries)})
	})))

	mux.Handle("GET /api/v1/admin/system-health", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := authhttp.CurrentPrincipal(r.Context()); !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		health, err := service.GetSystemHealth(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": health})
	})))

	mux.Handle("GET /api/v1/admin/scheduler/pauses", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := authhttp.CurrentPrincipal(r.Context()); !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		pauses, err := service.ListSchedulerPauses(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": pauses, "count": len(pauses)})
	})))

	mux.Handle("POST /api/v1/admin/scheduler/pauses", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		var pause ingestiondomain.SchedulerPause
		if err := json.NewDecoder(r.Body).Decode(&pause); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		saved, err := service.CreateSchedulerPause(r.Context(), principal.User, pause)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusCreated, map[string]any{"item": saved})
	})))

	mux.Handle("DELETE /api/v1/admin/scheduler/pauses/{pauseID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		if err := service.DeleteSchedulerPause(r.Context(), principal.User, strings.TrimSpace(r.PathValue("pauseID"))); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})))

	mux.Handle("GET /api/v1/admin/maintenance-windows", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := authhttp.CurrentPrincipal(r.Context()); !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		windows, err := service.ListMaintenanceWindows(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": windows, "count": len(windows)})
	})))

	mux.Handle("POST /api/v1/admin/maintenance-windows", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		var window ingestiondomain.MaintenanceWindow
		if err := json.NewDecoder(r.Body).Decode(&window); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		saved, err := service.CreateMaintenanceWindow(r.Context(), principal.User, window)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusCreated, map[string]any{"item": saved})
	})))

	mux.Handle("DELETE /api/v1/admin/maintenance-windows/{windowID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		if err := service.DeleteMaintenanceWindow(r.Context(), principal.User, strings.TrimSpace(r.PathValue("windowID"))); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})))

	mux.Handle("GET /api/v1/admin/workspace/export", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := authhttp.CurrentPrincipal(r.Context()); !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		exported, err := service.ExportWorkspace(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": exported})
	})))

	mux.Handle("POST /api/v1/admin/workspace/restore", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		dryRun := strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("dry_run")), "true")
		var payload ingestionapp.WorkspaceExport
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		preview, err := service.RestoreWorkspace(r.Context(), principal.User, payload, dryRun)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": preview})
	})))
}

func readCSVInput(r *http.Request) (io.Reader, error) {
	contentType := strings.TrimSpace(r.Header.Get("Content-Type"))
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			return nil, err
		}
		file, _, err := r.FormFile("file")
		if err != nil {
			return nil, err
		}
		defer file.Close()
		data, err := io.ReadAll(file)
		if err != nil {
			return nil, err
		}
		return bytes.NewReader(data), nil
	}
	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}
