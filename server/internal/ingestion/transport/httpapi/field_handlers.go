package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	app "home-searcher/server/internal/ingestion/application"
	ingestiondomain "home-searcher/server/internal/ingestion/domain"
	platformhttp "home-searcher/server/internal/platform/httpapi"
)

type fieldAssignmentRequest struct {
	FieldName    string `json:"field_name"`
	PropertyID   string `json:"property_id"`
	SelectorName string `json:"selector_name"`
}

// RegisterFields binds canonical field and unmapped-field routes.
func RegisterFields(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, service *app.FieldService) {
	mux.Handle("GET /api/v1/backoffice/fields", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fields, err := service.ListFieldDefinitions(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": fields, "count": len(fields)})
	})))

	mux.Handle("POST /api/v1/backoffice/fields", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request ingestiondomain.FieldDefinition
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
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
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
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

	mux.Handle("GET /api/v1/backoffice/fields/unmapped", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		items, err := service.ListUnmappedFieldGroups(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": items, "count": len(items)})
	})))

	mux.Handle("POST /api/v1/backoffice/fields/unmapped/assign", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request fieldAssignmentRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := service.AssignUnmappedField(r.Context(), request.PropertyID, request.SelectorName, request.FieldName); err != nil {
			status := http.StatusBadRequest
			if errors.Is(err, app.ErrFieldDefinitionNotFound) {
				status = http.StatusNotFound
			}
			platformhttp.WriteError(w, status, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	})))

	mux.Handle("GET /api/v1/backoffice/analytics/dataset", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		items, err := service.ListAnalyticsRecords(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": items, "count": len(items)})
	})))
}
