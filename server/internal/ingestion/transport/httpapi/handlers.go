package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	authhttp "home-searcher/server/internal/auth/transport/httpapi"
	app "home-searcher/server/internal/ingestion/application"
	ingestiondomain "home-searcher/server/internal/ingestion/domain"
	platformevents "home-searcher/server/internal/platform/events"
	platformhttp "home-searcher/server/internal/platform/httpapi"
)

// Register binds ingestion and backoffice HTTP routes to the supplied mux.
func Register(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, service *app.Service, broker *platformevents.Broker) {
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

	mux.Handle("GET /api/v1/backoffice/runs", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		runs, err := service.ListRuns(
			r.Context(),
			strings.TrimSpace(r.URL.Query().Get("source_id")),
			parseLimit(r.URL.Query().Get("limit")),
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
			if errors.Is(err, app.ErrRunNotFound) {
				platformhttp.WriteError(w, http.StatusNotFound, err.Error())
				return
			}

			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": run})
	})))

	mux.Handle("POST /api/v1/backoffice/sources/{sourceID}/ingest", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sourceID := strings.TrimSpace(r.PathValue("sourceID"))
		if sourceID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "source id is required")
			return
		}

		run, err := service.IngestSource(r.Context(), sourceID, app.IngestOptions{
			TriggerKind: ingestiondomain.TriggerKindManual,
			Force:       parseForce(r.URL.Query().Get("force")),
		})
		if err != nil {
			if errors.Is(err, app.ErrSourceNotFound) {
				platformhttp.WriteError(w, http.StatusNotFound, err.Error())
				return
			}
			if errors.Is(err, app.ErrSourceLocked) {
				platformhttp.WriteError(w, http.StatusConflict, err.Error())
				return
			}
			if errors.Is(err, app.ErrSourceRateLimited) {
				platformhttp.WriteError(w, http.StatusTooManyRequests, err.Error())
				return
			}

			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": run})
	})))

	mux.Handle("GET /api/v1/backoffice/events", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		_ = principal

		events, cancel := broker.Subscribe(32)
		defer cancel()
		platformhttp.StreamSSE(w, r, events)
	})))
}

func parseLimit(raw string) int {
	if strings.TrimSpace(raw) == "" {
		return 0
	}

	limit, err := strconv.Atoi(raw)
	if err != nil {
		return 0
	}

	return limit
}

func parseForce(raw string) bool {
	parsed, _ := strconv.ParseBool(strings.TrimSpace(raw))
	return parsed
}
