package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	app "nido/server/internal/ingestion/application"
	ingestiondomain "nido/server/internal/ingestion/domain"
	platformhttp "nido/server/internal/platform/httpapi"
)

// Register binds source-template HTTP routes to the supplied mux.
func Register(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, service *app.Service) {
	mux.Handle("GET /api/v1/backoffice/sources", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sources, err := service.ListSources(r.Context())
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{
			"items": sources,
			"count": len(sources),
		})
	})))

	mux.Handle("POST /api/v1/backoffice/sources", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request ingestiondomain.Source
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
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

// RegisterRuns binds property-run HTTP routes to the supplied mux.
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

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{
			"items": runs,
			"count": len(runs),
		})
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
