/**
 * File: internal/ingestion/transport/httpapi/handlers.go
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
 * - errors
 * - net/http
 * - strings
 * - nido/server/internal/ingestion/application
 * - nido/server/internal/ingestion/domain
 * - nido/server/internal/platform/httpapi
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package httpapi

import (
	"errors"
	"net/http"
	"strings"

	app "nido/server/internal/ingestion/application"
	ingestiondomain "nido/server/internal/ingestion/domain"
	platformhttp "nido/server/internal/platform/httpapi"
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
	mux.Handle("GET /api/v1/backoffice/sources", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sources, err := service.ListSources(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WritePaginatedJSON(w, r, http.StatusOK, sources, nil)
	})))

	mux.Handle("POST /api/v1/backoffice/sources", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request ingestiondomain.Source
		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}

		source, err := service.EnsureSource(r.Context(), request)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusCreated, map[string]any{"item": source})
	})))

	mux.Handle("GET /api/v1/backoffice/sources/{sourceID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		source, err := service.GetSource(r.Context(), strings.TrimSpace(r.PathValue("sourceID")))
		if err != nil {
			if errors.Is(err, app.ErrSourceNotFound) {
				platformhttp.WriteError(w, http.StatusNotFound, err.Error())
				return
			}

			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": source})
	})))

	mux.Handle("DELETE /api/v1/backoffice/sources/{sourceID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sourceID := strings.TrimSpace(r.PathValue("sourceID"))
		if sourceID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "source id is required")
			return
		}

		if err := service.DeleteSource(r.Context(), sourceID); err != nil {
			if errors.Is(err, app.ErrSourceNotFound) {
				platformhttp.WriteError(w, http.StatusNotFound, err.Error())
				return
			}

			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})))
}

/**
 * Purpose:
 * Performs the RegisterRuns operation for this backend package.
 *
 * Parameters:
 * - mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, service *app.PropertyService
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
func RegisterRuns(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, service *app.PropertyService) {
	mux.Handle("GET /api/v1/backoffice/runs", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		runs, err := service.ListRuns(
			r.Context(),
			strings.TrimSpace(r.URL.Query().Get("property_id")),
			platformhttp.ParseLimit(r.URL.Query().Get("limit")),
		)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WritePaginatedJSON(w, r, http.StatusOK, runs, nil)
	})))

	mux.Handle("GET /api/v1/backoffice/runs/{runID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		run, err := service.GetRun(r.Context(), strings.TrimSpace(r.PathValue("runID")))
		if err != nil {
			if errors.Is(err, app.ErrPropertyRunNotFound) {
				platformhttp.WriteError(w, http.StatusNotFound, err.Error())
				return
			}

			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": run})
	})))

	mux.Handle("DELETE /api/v1/backoffice/runs/{runID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		runID := strings.TrimSpace(r.PathValue("runID"))
		if runID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "run id is required")
			return
		}

		if err := service.DeleteRun(r.Context(), runID); err != nil {
			if errors.Is(err, app.ErrPropertyRunNotFound) {
				platformhttp.WriteError(w, http.StatusNotFound, err.Error())
				return
			}

			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})))
}
