package httpapi

import (
	"errors"
	"net/http"
	"strings"

	app "nido/server/internal/ingestion/application"
	platformhttp "nido/server/internal/platform/httpapi"
)

// RegisterTags binds tag management HTTP routes to the supplied mux.
func RegisterTags(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, tagService *app.TagService, propertyService *app.PropertyService) {
	// List all tags
	mux.Handle("GET /api/v1/backoffice/tags", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tags, err := tagService.ListTags(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WritePaginatedJSON(w, r, http.StatusOK, tags, nil)
	})))

	// Create a new tag
	mux.Handle("POST /api/v1/backoffice/tags", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Name  string `json:"name"`
			Color string `json:"color"`
		}
		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}

		tag, err := tagService.CreateTag(r.Context(), request.Name, request.Color)
		if err != nil {
			if errors.Is(err, app.ErrInvalidTagName) {
				platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
				return
			}
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusCreated, map[string]any{"item": tag})
	})))

	// Delete a tag
	mux.Handle("DELETE /api/v1/backoffice/tags/{tagID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tagID := strings.TrimSpace(r.PathValue("tagID"))
		if tagID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "tag id is required")
			return
		}

		if err := tagService.DeleteTag(r.Context(), tagID); err != nil {
			if errors.Is(err, app.ErrTagNotFound) {
				platformhttp.WriteError(w, http.StatusNotFound, err.Error())
				return
			}
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})))

	// List tags for a property
	mux.Handle("GET /api/v1/backoffice/properties/{propertyID}/tags", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		tags, err := tagService.ListPropertyTags(r.Context(), propertyID)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WritePaginatedJSON(w, r, http.StatusOK, tags, nil)
	})))

	// Replace all tags for a property
	mux.Handle("PUT /api/v1/backoffice/properties/{propertyID}/tags", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		var request struct {
			TagIDs []string `json:"tag_ids"`
		}
		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}

		if err := tagService.AssignTags(r.Context(), propertyID, request.TagIDs); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	})))

	// Add a single tag to a property
	mux.Handle("POST /api/v1/backoffice/properties/{propertyID}/tags/{tagID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		tagID := strings.TrimSpace(r.PathValue("tagID"))
		if propertyID == "" || tagID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id and tag id are required")
			return
		}

		if err := tagService.AddTag(r.Context(), propertyID, tagID); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "added"})
	})))

	// Remove a single tag from a property
	mux.Handle("DELETE /api/v1/backoffice/properties/{propertyID}/tags/{tagID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		tagID := strings.TrimSpace(r.PathValue("tagID"))
		if propertyID == "" || tagID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id and tag id are required")
			return
		}

		if err := tagService.RemoveTag(r.Context(), propertyID, tagID); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "removed"})
	})))
}
