/**
 * File: internal/ingestion/transport/httpapi/field_handlers.go
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
 * Performs the RegisterFields operation for this backend package.
 *
 * Parameters:
 * - mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, service *app.FieldService
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
func RegisterFields(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, service *app.FieldService) {
	mux.Handle("GET /api/v1/backoffice/fields", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fields, err := service.ListFieldDefinitions(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WritePaginatedJSON(w, r, http.StatusOK, fields, nil)
	})))

	mux.Handle("POST /api/v1/backoffice/fields", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request ingestiondomain.FieldDefinition
		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}
		field, err := service.CreateFieldDefinition(r.Context(), request)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusCreated, map[string]any{"item": field})
	})))

	mux.Handle("PUT /api/v1/backoffice/fields/{fieldID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fieldID := strings.TrimSpace(r.PathValue("fieldID"))
		var request ingestiondomain.FieldDefinition
		if fieldID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "field id is required")
			return
		}
		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}
		field, err := service.UpdateFieldDefinition(r.Context(), fieldID, request)
		if err != nil {
			status := http.StatusBadRequest
			if errors.Is(err, app.ErrFieldDefinitionNotFound) {
				status = http.StatusNotFound
			}
			platformhttp.WriteError(w, status, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": field})
	})))

	mux.Handle("DELETE /api/v1/backoffice/fields/{fieldID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fieldID := strings.TrimSpace(r.PathValue("fieldID"))
		if fieldID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "field id is required")
			return
		}
		if err := service.DeleteFieldDefinition(r.Context(), fieldID); err != nil {
			status := http.StatusBadRequest
			if errors.Is(err, app.ErrFieldDefinitionNotFound) {
				status = http.StatusNotFound
			}
			platformhttp.WriteError(w, status, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})))

	mux.Handle("GET /api/v1/backoffice/analytics/dataset", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		items, err := service.ListAnalyticsRecords(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WritePaginatedJSON(w, r, http.StatusOK, items, nil)
	})))
}
