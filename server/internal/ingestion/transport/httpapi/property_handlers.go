package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
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
	Status                  *string                           `json:"status,omitempty"`
	SourceID                *string                           `json:"source_id,omitempty"`
	URL                     string                            `json:"url"`
	Paused                  *bool                             `json:"paused,omitempty"`
	PauseReason             *string                           `json:"pause_reason,omitempty"`
	Metadata                *ingestiondomain.PropertyMetadata `json:"metadata,omitempty"`
	ManualData              map[string]json.RawMessage        `json:"manual_data,omitempty"`
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
		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}

		manualValues, err := manualDataFromRequest(request.ManualData)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		if isManualTrackingRequest(request) && len(manualValues) == 0 {
			platformhttp.WriteError(w, http.StatusBadRequest, "manual snapshot values are required")
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
		if !platformhttp.DecodeJSON(w, r, &request) {
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
		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}

		manualValues, err := manualDataFromRequest(request.ManualData)
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		property, err := service.UpsertPropertyWithManualData(r.Context(), mergePropertyUpsertRequest(existing, request), manualValues)
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
		if !platformhttp.DecodeJSON(w, r, &body) {
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
		if !platformhttp.DecodeJSON(w, r, &body) {
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
		if !platformhttp.DecodeJSON(w, r, &request) {
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
	if request.Status != nil {
		property.Status = ingestiondomain.PropertyStatus(strings.TrimSpace(*request.Status))
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
	if request.Status != nil {
		property.Status = ingestiondomain.PropertyStatus(strings.TrimSpace(*request.Status))
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

func isManualTrackingRequest(request propertyUpsertRequest) bool {
	if request.Metadata == nil {
		return strings.TrimSpace(request.URL) == "" && strings.TrimSpace(optionalString(request.SourceID)) == ""
	}

	return strings.EqualFold(strings.TrimSpace(request.Metadata.TrackingMode), "manual")
}

func optionalString(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}

func manualDataFromRequest(request map[string]json.RawMessage) (map[string]string, error) {
	if len(request) == 0 {
		return nil, nil
	}

	values := map[string]string{}
	for rawKey, rawValue := range request {
		key := normalizeManualDataKey(rawKey)
		if key == "" || string(rawValue) == "null" {
			continue
		}

		value, err := stringifyManualDataValue(rawValue)
		if err != nil {
			return nil, err
		}
		if value != "" {
			values[key] = value
		}
	}
	if len(values) == 0 {
		return nil, nil
	}

	return values, nil
}

func normalizeManualDataKey(value string) string {
	normalized := strings.TrimSpace(strings.ToLower(value))
	normalized = strings.ReplaceAll(normalized, " ", "_")
	normalized = strings.ReplaceAll(normalized, "-", "_")
	return normalized
}

func stringifyManualDataValue(raw json.RawMessage) (string, error) {
	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		return strings.TrimSpace(text), nil
	}

	var number float64
	if err := json.Unmarshal(raw, &number); err == nil {
		if number == float64(int64(number)) {
			return strconv.FormatInt(int64(number), 10), nil
		}

		return strconv.FormatFloat(number, 'f', -1, 64), nil
	}

	var boolean bool
	if err := json.Unmarshal(raw, &boolean); err == nil {
		return strconv.FormatBool(boolean), nil
	}

	return "", fmt.Errorf("manual data values must be strings, numbers, or booleans")
}
