package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	app "nido/server/internal/ingestion/application"
	ingestiondomain "nido/server/internal/ingestion/domain"
	platformhttp "nido/server/internal/platform/httpapi"
)

type propertyUpsertRequest struct {
	Label                   string                            `json:"label"`
	RetryBackoffMillis      *int                              `json:"retry_backoff_millis,omitempty"`
	RetryMaxAttempts        *int                              `json:"retry_max_attempts,omitempty"`
	ScheduleIntervalSeconds *int                              `json:"schedule_interval_seconds,omitempty"`
	SourceID                *string                           `json:"source_id,omitempty"`
	URL                     string                            `json:"url"`
	Paused                  *bool                             `json:"paused,omitempty"`
	PauseReason             *string                           `json:"pause_reason,omitempty"`
	Metadata                *ingestiondomain.PropertyMetadata `json:"metadata,omitempty"`
	ManualData              *propertyManualDataRequest        `json:"manual_data,omitempty"`
}

type propertyManualDataRequest struct {
	AreaSqm     *float64 `json:"area_sqm,omitempty"`
	Bathrooms   *float64 `json:"bathrooms,omitempty"`
	Location    *string  `json:"location,omitempty"`
	Price       *int64   `json:"price,omitempty"`
	PropertyAge *int64   `json:"property_age,omitempty"`
	Rooms       *float64 `json:"rooms,omitempty"`
}

// RegisterProperties binds property tracking HTTP routes to the supplied mux.
func RegisterProperties(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, service *app.PropertyService) {
	mux.Handle("GET /api/v1/backoffice/properties", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Parse tag filtering parameters
		tagIDs := r.URL.Query()["tag_id"]
		tagMatch := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("tag_match")))
		matchAll := tagMatch == "all"
		status := strings.TrimSpace(r.URL.Query().Get("status"))
		priorityLevel := strings.TrimSpace(r.URL.Query().Get("priority_level"))
		businessStage := strings.TrimSpace(r.URL.Query().Get("business_stage"))

		properties, err := service.ListPropertiesFiltered(r.Context(), tagIDs, matchAll, status, priorityLevel, businessStage)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{
			"items": properties,
			"count": len(properties),
		})
	})))

	mux.Handle("POST /api/v1/backoffice/properties", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request propertyUpsertRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		manualValues := manualDataFromRequest(request.ManualData)
		if _, ok := manualValues["price"]; !ok {
			platformhttp.WriteError(w, http.StatusBadRequest, "price is required")
			return
		}

		property, err := service.UpsertPropertyWithManualData(r.Context(), propertyFromUpsertRequest(request), manualValues)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusCreated, map[string]any{"item": property})
	})))

	// Stateless preview — no property ID required.  Must be registered BEFORE
	// the /{propertyID}/preview pattern so that the static segment wins.
	mux.Handle("POST /api/v1/backoffice/properties/preview", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request ingestiondomain.PropertyPreviewRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		result, err := service.PreviewExtraction(r.Context(), request)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": result})
	})))

	// Static-path patterns must be registered before the /{propertyID} wildcard.
	mux.Handle("GET /api/v1/backoffice/properties/summaries", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tagIDs := r.URL.Query()["tag_id"]
		tagMatch := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("tag_match")))
		matchAll := tagMatch == "all"
		status := strings.TrimSpace(r.URL.Query().Get("status"))
		priorityLevel := strings.TrimSpace(r.URL.Query().Get("priority_level"))
		businessStage := strings.TrimSpace(r.URL.Query().Get("business_stage"))

		summaries, err := service.ListPropertySummaries(r.Context(), tagIDs, matchAll, status, priorityLevel, businessStage)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{
			"items": summaries,
			"count": len(summaries),
		})
	})))

	mux.Handle("GET /api/v1/backoffice/properties/{propertyID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		property, err := service.GetProperty(r.Context(), propertyID)
		if err != nil {
			if errors.Is(err, app.ErrPropertyNotFound) {
				platformhttp.WriteError(w, http.StatusNotFound, err.Error())
				return
			}

			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": property})
	})))

	mux.Handle("PUT /api/v1/backoffice/properties/{propertyID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		existing, err := service.GetProperty(r.Context(), propertyID)
		if err != nil {
			if errors.Is(err, app.ErrPropertyNotFound) {
				platformhttp.WriteError(w, http.StatusNotFound, err.Error())
				return
			}
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		var request propertyUpsertRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		property, err := service.UpsertPropertyWithManualData(r.Context(), mergePropertyUpsertRequest(existing, request), manualDataFromRequest(request.ManualData))
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": property})
	})))

	mux.Handle("DELETE /api/v1/backoffice/properties/{propertyID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		if err := service.DeleteProperty(r.Context(), propertyID); err != nil {
			if errors.Is(err, app.ErrPropertyNotFound) {
				platformhttp.WriteError(w, http.StatusNotFound, err.Error())
				return
			}

			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})))

	mux.Handle("POST /api/v1/backoffice/properties/{propertyID}/config", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		var body struct {
			Fields []ingestiondomain.FieldSelector `json:"fields"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		config, err := service.UpsertPropertyConfig(r.Context(), propertyID, body.Fields)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusCreated, map[string]any{"item": config})
	})))

	mux.Handle("GET /api/v1/backoffice/properties/{propertyID}/config", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		config, err := service.GetLatestPropertyConfig(r.Context(), propertyID)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": config})
	})))

	mux.Handle("GET /api/v1/backoffice/properties/{propertyID}/config/versions", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		configs, err := service.ListPropertyConfigs(r.Context(), propertyID)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": configs, "count": len(configs)})
	})))

	mux.Handle("GET /api/v1/backoffice/properties/{propertyID}/config/versions/{version}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		version, err := strconv.Atoi(strings.TrimSpace(r.PathValue("version")))
		if propertyID == "" || err != nil || version <= 0 {
			platformhttp.WriteError(w, http.StatusBadRequest, "valid property id and config version are required")
			return
		}

		config, err := service.GetPropertyConfigVersion(r.Context(), propertyID, version)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": config})
	})))

	mux.Handle("POST /api/v1/backoffice/properties/{propertyID}/config/rollback", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		var body struct {
			Version int `json:"version"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if body.Version <= 0 {
			platformhttp.WriteError(w, http.StatusBadRequest, "config version is required")
			return
		}

		config, err := service.RollbackPropertyConfig(r.Context(), propertyID, body.Version)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusCreated, map[string]any{"item": config})
	})))

	mux.Handle("POST /api/v1/backoffice/properties/{propertyID}/preview", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		var request ingestiondomain.PropertyPreviewRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		result, err := service.PreviewExtraction(r.Context(), request)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": result})
	})))

	mux.Handle("POST /api/v1/backoffice/properties/{propertyID}/ingest", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		snapshot, err := service.IngestProperty(r.Context(), propertyID)
		if err != nil {
			if errors.Is(err, app.ErrPropertyNotFound) {
				platformhttp.WriteError(w, http.StatusNotFound, err.Error())
				return
			}

			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": snapshot})
	})))

	mux.Handle("GET /api/v1/backoffice/properties/{propertyID}/snapshots", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		snapshots, err := service.ListPropertySnapshots(
			r.Context(),
			propertyID,
			platformhttp.ParseLimit(r.URL.Query().Get("limit")),
		)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{
			"items": snapshots,
			"count": len(snapshots),
		})
	})))

	// List property runs (new property_runs table)
	mux.Handle("GET /api/v1/backoffice/properties/{propertyID}/runs", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		runs, err := service.ListPropertyRuns(
			r.Context(),
			propertyID,
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

	// Decision context + change intelligence summary for one property.
	mux.Handle("GET /api/v1/backoffice/properties/{propertyID}/summary", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		propertyID := strings.TrimSpace(r.PathValue("propertyID"))
		if propertyID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "property id is required")
			return
		}

		summary, err := service.GetPropertySummary(r.Context(), propertyID)
		if err != nil {
			if errors.Is(err, app.ErrPropertyNotFound) {
				platformhttp.WriteError(w, http.StatusNotFound, err.Error())
				return
			}
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": summary})
	})))
}

func propertyFromUpsertRequest(request propertyUpsertRequest) ingestiondomain.Property {
	property := ingestiondomain.Property{
		Label: request.Label,
		URL:   request.URL,
	}
	if request.SourceID != nil {
		property.SourceID = strings.TrimSpace(*request.SourceID)
	}
	if request.ScheduleIntervalSeconds != nil {
		property.ScheduleIntervalSeconds = *request.ScheduleIntervalSeconds
	}
	if request.RetryMaxAttempts != nil {
		property.RetryMaxAttempts = *request.RetryMaxAttempts
	}
	if request.RetryBackoffMillis != nil {
		property.RetryBackoffMillis = *request.RetryBackoffMillis
	}
	if request.Paused != nil {
		property.Paused = *request.Paused
	}
	if request.PauseReason != nil {
		property.PauseReason = strings.TrimSpace(*request.PauseReason)
	}
	if request.Metadata != nil {
		property.Metadata = *request.Metadata
	}
	return property
}

func mergePropertyUpsertRequest(existing ingestiondomain.Property, request propertyUpsertRequest) ingestiondomain.Property {
	property := existing
	property.URL = request.URL
	property.Label = request.Label
	if request.SourceID != nil {
		property.SourceID = strings.TrimSpace(*request.SourceID)
	}
	if request.ScheduleIntervalSeconds != nil {
		property.ScheduleIntervalSeconds = *request.ScheduleIntervalSeconds
	}
	if request.RetryMaxAttempts != nil {
		property.RetryMaxAttempts = *request.RetryMaxAttempts
	}
	if request.RetryBackoffMillis != nil {
		property.RetryBackoffMillis = *request.RetryBackoffMillis
	}
	if request.Paused != nil {
		property.Paused = *request.Paused
	}
	if request.PauseReason != nil {
		property.PauseReason = strings.TrimSpace(*request.PauseReason)
	}
	if request.Metadata != nil {
		property.Metadata = *request.Metadata
	}
	return property
}

func manualDataFromRequest(request *propertyManualDataRequest) map[string]string {
	if request == nil {
		return nil
	}

	values := map[string]string{}
	if request.Price != nil {
		values["price"] = strconv.FormatInt(*request.Price, 10)
	}
	if request.AreaSqm != nil {
		values["area_m2"] = strconv.FormatFloat(*request.AreaSqm, 'f', -1, 64)
	}
	if request.Rooms != nil {
		values["rooms"] = strconv.FormatFloat(*request.Rooms, 'f', -1, 64)
	}
	if request.Bathrooms != nil {
		values["bathrooms"] = strconv.FormatFloat(*request.Bathrooms, 'f', -1, 64)
	}
	if request.PropertyAge != nil {
		values["property_age"] = strconv.FormatInt(*request.PropertyAge, 10)
	}
	if request.Location != nil {
		trimmed := strings.TrimSpace(*request.Location)
		if trimmed != "" {
			values["location"] = trimmed
		}
	}
	if len(values) == 0 {
		return nil
	}

	return values
}
