/**
 * File: internal/platformops/transport/httpapi/handlers.go
 *
 * Purpose:
 * Exposes HTTP transport handlers and request/response adaptation for this backend area.
 *
 * Responsibilities:
 * - Decode and validate HTTP requests
 * - Call application services
 * - Encode stable JSON responses and errors
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - net/http
 * - net/url
 * - path/filepath
 * - strconv
 * - strings
 * - nido/server/internal/platform/httpapi
 * - nido/server/internal/platformops/application
 * - nido/server/internal/platformops/domain
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package httpapi

import (
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"

	platformhttp "nido/server/internal/platform/httpapi"
	app "nido/server/internal/platformops/application"
	platformopsdomain "nido/server/internal/platformops/domain"
)

/**
 * Purpose:
 * Performs the Register operation for this backend package.
 *
 * Parameters:
 * - mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, service *app.Service
 *
 * Returns:
 * - None.
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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
		if !platformhttp.DecodeJSON(w, r, &request) {
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

	mux.Handle("GET /api/v1/backoffice/platform/backup", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		backup, err := service.ExportWorkspaceBackup(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": backup})
	})))

	mux.Handle("POST /api/v1/backoffice/platform/backup-files", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		file, err := service.CreateWorkspaceBackupFile(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusCreated, map[string]any{"item": file})
	})))

	mux.Handle("GET /api/v1/backoffice/platform/backup-files", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		files, err := service.ListWorkspaceBackupFiles()
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WritePaginatedJSON(w, r, http.StatusOK, files, nil)
	})))

	mux.Handle("GET /api/v1/backoffice/platform/backup-files/{name}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, err := service.BackupFilePath(r.PathValue("name"))
		if err != nil {
			platformhttp.WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		fileName := filepath.Base(path)
		w.Header().Set("Content-Disposition", "attachment; filename*=UTF-8''"+url.PathEscape(fileName))
		http.ServeFile(w, r, path)
	})))

	mux.Handle("POST /api/v1/backoffice/platform/restore", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request platformopsdomain.WorkspaceBackup
		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}
		if err := service.RestoreWorkspaceBackup(r.Context(), request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "restored"})
	})))

	mux.Handle("POST /api/v1/backoffice/platform/reset", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := service.ResetWorkspace(r.Context()); err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "reset"})
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
		platformhttp.WritePaginatedJSON(w, r, http.StatusOK, logs, nil)
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
