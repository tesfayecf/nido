package app

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"nido/server/internal/platform/config"
)

func TestRuntimeAllowsLoopbackCORSRequests(t *testing.T) {
	t.Parallel()

	server, _ := newRuntimeServer(t)
	defer server.Close()

	origin := "http://localhost:4173"
	preflight, err := http.NewRequest(http.MethodOptions, server.URL+"/api/v1/auth/login", nil)
	if err != nil {
		t.Fatalf("new preflight request: %v", err)
	}
	preflight.Header.Set("Origin", origin)
	preflight.Header.Set("Access-Control-Request-Method", http.MethodPost)
	preflight.Header.Set("Access-Control-Request-Headers", "content-type")

	preflightResponse, err := http.DefaultClient.Do(preflight)
	if err != nil {
		t.Fatalf("do preflight request: %v", err)
	}
	defer preflightResponse.Body.Close()

	if preflightResponse.StatusCode != http.StatusNoContent {
		body, readErr := io.ReadAll(preflightResponse.Body)
		if readErr != nil {
			t.Fatalf("unexpected preflight status %d and read body: %v", preflightResponse.StatusCode, readErr)
		}
		t.Fatalf("unexpected preflight status %d, body=%s", preflightResponse.StatusCode, string(body))
	}
	if got := preflightResponse.Header.Get("Access-Control-Allow-Origin"); got != origin {
		t.Fatalf("unexpected preflight allow origin: %q", got)
	}
	if got := preflightResponse.Header.Get("Access-Control-Allow-Headers"); got != "content-type" {
		t.Fatalf("unexpected preflight allow headers: %q", got)
	}
	if got := preflightResponse.Header.Get("Access-Control-Allow-Methods"); !strings.Contains(got, http.MethodPost) {
		t.Fatalf("expected preflight methods to include POST, got %q", got)
	}

	loginPayload, err := json.Marshal(map[string]string{
		"email":    "admin@local",
		"password": "dev-password",
	})
	if err != nil {
		t.Fatalf("marshal login payload: %v", err)
	}

	loginRequest, err := http.NewRequest(http.MethodPost, server.URL+"/api/v1/auth/login", bytes.NewReader(loginPayload))
	if err != nil {
		t.Fatalf("new login request: %v", err)
	}
	loginRequest.Header.Set("Origin", origin)
	loginRequest.Header.Set("Content-Type", "application/json")

	loginResponse, err := http.DefaultClient.Do(loginRequest)
	if err != nil {
		t.Fatalf("do login request: %v", err)
	}
	defer loginResponse.Body.Close()

	loginBody, err := io.ReadAll(loginResponse.Body)
	if err != nil {
		t.Fatalf("read login response: %v", err)
	}
	if loginResponse.StatusCode != http.StatusOK {
		t.Fatalf("unexpected login status %d, body=%s", loginResponse.StatusCode, string(loginBody))
	}
	if got := loginResponse.Header.Get("Access-Control-Allow-Origin"); got != origin {
		t.Fatalf("unexpected login allow origin: %q", got)
	}
	if !bytes.Contains(loginBody, []byte("token")) {
		t.Fatalf("expected login response body to contain token, body=%s", string(loginBody))
	}
}

func TestRuntimeBackupExportAndRestoreFlow(t *testing.T) {
	t.Parallel()

	server, token := newRuntimeServer(t)
	defer server.Close()

	createSource(t, server.URL, token, map[string]any{
		"id":          "backup-template",
		"name":        "Backup template",
		"config_json": `[{"name":"price","selectors":[".price"],"required":true,"field_name":"price"}]`,
	})
	property := createProperty(t, server.URL, token, map[string]any{
		"label":     "Backup property",
		"source_id": "backup-template",
		"url":       "https://example.com/properties/backup",
		"manual_data": map[string]any{
			"price":    320000,
			"location": "Bilbao",
		},
	})
	var tagResponse struct {
		Item struct {
			ID string `json:"id"`
		} `json:"item"`
	}
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/tags", token, map[string]any{
		"name":  "Priority",
		"color": "#ff7a59",
	}, http.StatusCreated, &tagResponse)
	mustJSONRequest(t, http.MethodPut, server.URL+"/api/v1/backoffice/properties/"+property.ID+"/tags", token, map[string]any{
		"tag_ids": []string{tagResponse.Item.ID},
	}, http.StatusOK, nil)
	mustJSONRequest(t, http.MethodPut, server.URL+"/api/v1/backoffice/platform/settings", token, map[string]any{
		"id":                         "platform",
		"scheduler_enabled":          false,
		"maintenance_window_enabled": true,
		"maintenance_window_start":   "22:00",
		"maintenance_window_end":     "06:00",
		"webhook":                    map[string]any{"events": []string{"property.created"}},
		"slack":                      map[string]any{},
		"spreadsheet":                map[string]any{},
		"task_system":                map[string]any{},
		"email_digest":               map[string]any{"enabled": false, "schedule": "09:00", "events": []string{}},
	}, http.StatusOK, nil)

	var backupEnvelope struct {
		Item json.RawMessage `json:"item"`
	}
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/platform/backup", token, nil, http.StatusOK, &backupEnvelope)
	var backup struct {
		SchemaVersion int `json:"schema_version"`
		Sources       []struct {
			ID string `json:"id"`
		} `json:"sources"`
		Properties []struct {
			ID string `json:"id"`
		} `json:"properties"`
		PropertyRuns []struct {
			ID string `json:"id"`
		} `json:"property_runs"`
		PropertySnapshots []struct {
			ID string `json:"id"`
		} `json:"property_snapshots"`
		Tags []struct {
			ID string `json:"id"`
		} `json:"tags"`
		PropertyTags []struct {
			PropertyID string `json:"property_id"`
			TagID      string `json:"tag_id"`
		} `json:"property_tags"`
		PlatformSettings struct {
			SchedulerEnabled bool `json:"scheduler_enabled"`
		} `json:"platform_settings"`
	}
	if err := json.Unmarshal(backupEnvelope.Item, &backup); err != nil {
		t.Fatalf("decode backup payload: %v", err)
	}
	if backup.SchemaVersion != 1 {
		t.Fatalf("unexpected backup schema version: %d", backup.SchemaVersion)
	}
	if len(backup.Sources) != 1 || backup.Sources[0].ID != "backup-template" {
		t.Fatalf("unexpected backup sources: %+v", backup.Sources)
	}
	if len(backup.Properties) != 1 || backup.Properties[0].ID != property.ID {
		t.Fatalf("unexpected backup properties: %+v", backup.Properties)
	}
	if len(backup.PropertyRuns) == 0 || len(backup.PropertySnapshots) == 0 {
		t.Fatalf("expected backup to include manual property history: %+v", backup)
	}
	if len(backup.Tags) != 1 || len(backup.PropertyTags) != 1 {
		t.Fatalf("unexpected backup tag state: %+v", backup)
	}
	if backup.PropertyTags[0].PropertyID != property.ID || backup.PropertyTags[0].TagID != tagResponse.Item.ID {
		t.Fatalf("unexpected backup property-tag relationship: %+v", backup.PropertyTags[0])
	}
	if backup.PlatformSettings.SchedulerEnabled {
		t.Fatalf("expected exported platform settings to preserve scheduler toggle")
	}

	createSource(t, server.URL, token, map[string]any{
		"id":   "extra-template",
		"name": "Extra template",
	})
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/tags", token, map[string]any{
		"name":  "Temporary",
		"color": "#123456",
	}, http.StatusCreated, nil)
	mustJSONRequest(t, http.MethodDelete, server.URL+"/api/v1/backoffice/properties/"+property.ID, token, nil, http.StatusOK, nil)

	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/platform/restore", token, json.RawMessage(backupEnvelope.Item), http.StatusOK, nil)

	var restoredSources struct {
		Count int `json:"count"`
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/sources", token, nil, http.StatusOK, &restoredSources)
	if restoredSources.Count != 1 || restoredSources.Items[0].ID != "backup-template" {
		t.Fatalf("expected restore to overwrite sources, got %+v", restoredSources)
	}

	var restoredProperty struct {
		Item struct {
			ID string `json:"id"`
		} `json:"item"`
	}
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/properties/"+property.ID, token, nil, http.StatusOK, &restoredProperty)
	if restoredProperty.Item.ID != property.ID {
		t.Fatalf("unexpected restored property: %+v", restoredProperty)
	}

	var restoredTags struct {
		Count int `json:"count"`
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/properties/"+property.ID+"/tags", token, nil, http.StatusOK, &restoredTags)
	if restoredTags.Count != 1 || restoredTags.Items[0].ID != tagResponse.Item.ID {
		t.Fatalf("expected property tags to be restored, got %+v", restoredTags)
	}

	var restoredSettings struct {
		Item struct {
			SchedulerEnabled bool `json:"scheduler_enabled"`
		} `json:"item"`
	}
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/platform/settings", token, nil, http.StatusOK, &restoredSettings)
	if restoredSettings.Item.SchedulerEnabled {
		t.Fatalf("expected platform settings to be restored, got %+v", restoredSettings)
	}
}

func TestRuntimePropertyTrackingFlow(t *testing.T) {
	t.Parallel()

	propertyPage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `<html><body>
			<h1 data-field="title">Sunny flat</h1>
			<span data-field="price">250000</span>
			<span data-field="location">Bilbao</span>
		</body></html>`)
	}))
	defer propertyPage.Close()

	server, token := newRuntimeServer(t)
	defer server.Close()

	createSource(t, server.URL, token, map[string]any{
		"id":          "idealista-template",
		"name":        "Idealista template",
		"config_json": `[{"name":"price","selectors":["[data-field='price']"],"required":true},{"name":"title","selectors":["[data-field='title']"],"required":true},{"name":"location","selectors":["[data-field='location']"],"required":false}]`,
	})

	property := createProperty(t, server.URL, token, map[string]any{
		"source_id": "idealista-template",
		"url":       propertyPage.URL,
	})

	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/properties/"+property.ID+"/ingest", token, nil, http.StatusOK, nil)

	var runs struct {
		Count int `json:"count"`
		Items []struct {
			ID         string `json:"id"`
			PropertyID string `json:"property_id"`
			IsValid    bool   `json:"is_valid"`
		} `json:"items"`
	}
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/runs?property_id="+property.ID, token, nil, http.StatusOK, &runs)
	if runs.Count < 1 || len(runs.Items) < 1 {
		t.Fatalf("unexpected runs payload: %+v", runs)
	}
	if runs.Items[0].PropertyID != property.ID || !runs.Items[0].IsValid {
		t.Fatalf("unexpected run item: %+v", runs.Items[0])
	}

	var snapshots struct {
		Count int `json:"count"`
		Items []struct {
			Values map[string]string `json:"values"`
		} `json:"items"`
	}
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/properties/"+property.ID+"/snapshots", token, nil, http.StatusOK, &snapshots)
	if snapshots.Count < 1 || snapshots.Items[0].Values["title"] != "Sunny flat" {
		t.Fatalf("unexpected snapshots payload: %+v", snapshots)
	}
}

func TestRuntimeBookmarksAlertsAndNotificationsFlow(t *testing.T) {
	t.Parallel()

	currentPrice := "250000"
	propertyPage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `<html><body>
			<h1 data-field="title">Beach house</h1>
			<span data-field="price">`+currentPrice+`</span>
			<span data-field="location">Getxo</span>
		</body></html>`)
	}))
	defer propertyPage.Close()

	server, token := newRuntimeServer(t)
	defer server.Close()

	createSource(t, server.URL, token, map[string]any{
		"id":          "template-1",
		"name":        "Template One",
		"config_json": `[{"name":"price","selectors":["[data-field='price']"],"required":true},{"name":"title","selectors":["[data-field='title']"],"required":true},{"name":"location","selectors":["[data-field='location']"],"required":false}]`,
	})
	property := createProperty(t, server.URL, token, map[string]any{
		"source_id": "template-1",
		"url":       propertyPage.URL,
	})

	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/me/bookmarks", token, map[string]any{"property_id": property.ID}, http.StatusCreated, nil)
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/me/alert-rules", token, map[string]any{
		"property_id":      property.ID,
		"rule_type":        "price_below",
		"threshold_amount": 260000,
	}, http.StatusCreated, nil)

	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/properties/"+property.ID+"/ingest", token, nil, http.StatusOK, nil)

	var bookmarks struct {
		Count int `json:"count"`
		Items []struct {
			PropertyID string `json:"property_id"`
		} `json:"items"`
	}
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/me/bookmarks", token, nil, http.StatusOK, &bookmarks)
	if bookmarks.Count != 1 || bookmarks.Items[0].PropertyID != property.ID {
		t.Fatalf("unexpected bookmarks payload: %+v", bookmarks)
	}

	var notifications struct {
		Count int `json:"count"`
		Items []struct {
			ID     string  `json:"id"`
			Kind   string  `json:"kind"`
			ReadAt *string `json:"read_at"`
		} `json:"items"`
	}
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/me/notifications", token, nil, http.StatusOK, &notifications)
	if notifications.Count != 1 || notifications.Items[0].Kind != "price_below" {
		t.Fatalf("unexpected notifications payload: %+v", notifications)
	}

	notificationID := notifications.Items[0].ID
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/me/notifications/"+notificationID+"/read", token, nil, http.StatusOK, nil)
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/me/notifications/"+notificationID+"/unread", token, nil, http.StatusOK, nil)

	var refreshed struct {
		Items []struct {
			ReadAt *string `json:"read_at"`
		} `json:"items"`
	}
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/me/notifications", token, nil, http.StatusOK, &refreshed)
	if len(refreshed.Items) != 1 || refreshed.Items[0].ReadAt != nil {
		t.Fatalf("expected notification to be unread after reset, got %+v", refreshed.Items)
	}
}

func TestRuntimeAnalyticsDatasetUsesLatestNormalizedValues(t *testing.T) {
	t.Parallel()

	currentPrice := "250000"
	propertyPageOne := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `<html><body>
			<span data-field="price">`+currentPrice+`</span>
			<span data-field="rooms">3</span>
			<span data-field="location">Bilbao</span>
		</body></html>`)
	}))
	defer propertyPageOne.Close()

	propertyPageTwo := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `<html><body>
			<span data-field="price">310000</span>
			<span data-field="rooms">4</span>
			<span data-field="location">Getxo</span>
		</body></html>`)
	}))
	defer propertyPageTwo.Close()

	server, token := newRuntimeServer(t)
	defer server.Close()

	createSource(t, server.URL, token, map[string]any{
		"id":          "analytics-template",
		"name":        "Analytics template",
		"config_json": `[{"name":"price","selectors":["[data-field='price']"],"required":true,"field_name":"price"},{"name":"rooms","selectors":["[data-field='rooms']"],"required":false,"field_name":"rooms"},{"name":"location","selectors":["[data-field='location']"],"required":false,"field_name":"location"}]`,
	})

	propertyOne := createProperty(t, server.URL, token, map[string]any{
		"label":     "Bilbao flat",
		"source_id": "analytics-template",
		"url":       propertyPageOne.URL,
	})
	propertyTwo := createProperty(t, server.URL, token, map[string]any{
		"label":     "Getxo house",
		"source_id": "analytics-template",
		"url":       propertyPageTwo.URL,
	})

	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/properties/"+propertyOne.ID+"/ingest", token, nil, http.StatusOK, nil)
	currentPrice = "245000"
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/properties/"+propertyOne.ID+"/ingest", token, nil, http.StatusOK, nil)
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/properties/"+propertyTwo.ID+"/ingest", token, nil, http.StatusOK, nil)

	var dataset struct {
		Count int `json:"count"`
		Items []struct {
			PropertyID    string            `json:"property_id"`
			PropertyLabel string            `json:"property_label"`
			Values        map[string]string `json:"values"`
		} `json:"items"`
	}
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/analytics/dataset", token, nil, http.StatusOK, &dataset)
	if dataset.Count != 2 || len(dataset.Items) != 2 {
		t.Fatalf("unexpected analytics payload: %+v", dataset)
	}

	records := make(map[string]map[string]string, len(dataset.Items))
	for _, item := range dataset.Items {
		records[item.PropertyLabel] = item.Values
	}
	if got := records["Bilbao flat"]["price"]; got != "245000" {
		t.Fatalf("expected latest price for Bilbao flat, got %q", got)
	}
	if got := records["Getxo house"]["rooms"]; got != "4" {
		t.Fatalf("expected normalized rooms for Getxo house, got %q", got)
	}
}

func TestRuntimeShouldRejectInvalidEndpointRequestsWhenInputOrAuthIsInvalid(t *testing.T) {
	t.Parallel()

	server, token := newRuntimeServer(t)
	defer server.Close()

	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/sources", "", nil, http.StatusUnauthorized, nil)
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/auth/login", "", map[string]string{
		"email":    "admin@local",
		"password": "wrong-password",
	}, http.StatusUnauthorized, nil)
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/sources", token, map[string]any{
		"id":          "",
		"name":        "",
		"config_json": "{",
	}, http.StatusBadRequest, nil)
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/properties", token, map[string]any{
		"manual_data": map[string]any{
			"price": 250000,
		},
		"url": "ftp://example.invalid/listing",
	}, http.StatusBadRequest, nil)
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/sources/missing-source", token, nil, http.StatusNotFound, nil)
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/me/alert-rules", token, map[string]any{
		"property_id": "missing-property",
		"rule_type":   "not_supported",
	}, http.StatusBadRequest, nil)
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/tags", token, map[string]any{
		"name": "",
	}, http.StatusBadRequest, nil)
}

func TestRuntimeShouldPersistBackofficeDataWhenRequestsAreValid(t *testing.T) {
	t.Parallel()

	server, token := newRuntimeServer(t)
	defer server.Close()

	var sourceResponse struct {
		Item struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"item"`
	}
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/sources", token, map[string]any{
		"id":           "source-crud",
		"name":         "Source CRUD",
		"kind":         "html-listings",
		"endpoint_url": "https://example.com/feed",
		"config_json":  `{"item_selector":".listing"}`,
	}, http.StatusCreated, &sourceResponse)
	if sourceResponse.Item.ID != "source-crud" || sourceResponse.Item.Name != "Source CRUD" {
		t.Fatalf("unexpected source response: %+v", sourceResponse.Item)
	}

	property := createProperty(t, server.URL, token, map[string]any{
		"label":     "CRUD property",
		"source_id": "source-crud",
		"url":       "https://example.com/properties/1",
		"metadata": map[string]any{
			"priority_level": "high",
			"business_stage": "screening",
			"target_price":   210000,
		},
	})

	var tagResponse struct {
		Item struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"item"`
	}
	mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/tags", token, map[string]any{
		"name":  "Screening",
		"color": "#2563eb",
	}, http.StatusCreated, &tagResponse)
	if tagResponse.Item.ID == "" || tagResponse.Item.Name != "Screening" {
		t.Fatalf("unexpected tag response: %+v", tagResponse.Item)
	}

	mustJSONRequest(t, http.MethodPut, server.URL+"/api/v1/backoffice/properties/"+property.ID+"/tags", token, map[string]any{
		"tag_ids": []string{tagResponse.Item.ID},
	}, http.StatusOK, nil)

	var filtered struct {
		Count int `json:"count"`
		Items []struct {
			ID       string `json:"id"`
			Label    string `json:"label"`
			SourceID string `json:"source_id"`
		} `json:"items"`
	}
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/properties?tag_id="+tagResponse.Item.ID+"&priority_level=high&business_stage=screening", token, nil, http.StatusOK, &filtered)
	if filtered.Count != 1 || filtered.Items[0].ID != property.ID || filtered.Items[0].SourceID != "source-crud" {
		t.Fatalf("unexpected filtered properties: %+v", filtered)
	}

	var tags struct {
		Count int `json:"count"`
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/properties/"+property.ID+"/tags", token, nil, http.StatusOK, &tags)
	if tags.Count != 1 || tags.Items[0].ID != tagResponse.Item.ID {
		t.Fatalf("unexpected property tags: %+v", tags)
	}

	mustJSONRequest(t, http.MethodDelete, server.URL+"/api/v1/backoffice/properties/"+property.ID, token, nil, http.StatusOK, nil)
	mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/properties/"+property.ID, token, nil, http.StatusNotFound, nil)
}

type createdProperty struct {
	ID string `json:"id"`
}

func createSource(t *testing.T, baseURL, token string, payload map[string]any) {
	t.Helper()
	mustJSONRequest(t, http.MethodPost, baseURL+"/api/v1/backoffice/sources", token, payload, http.StatusCreated, nil)
}

func createProperty(t *testing.T, baseURL, token string, payload map[string]any) createdProperty {
	t.Helper()
	if _, ok := payload["manual_data"]; !ok {
		payload["manual_data"] = map[string]any{
			"price": 500000,
		}
	}
	var response struct {
		Item createdProperty `json:"item"`
	}
	mustJSONRequest(t, http.MethodPost, baseURL+"/api/v1/backoffice/properties", token, payload, http.StatusCreated, &response)
	return response.Item
}

func newRuntimeServer(t *testing.T) (*httptest.Server, string) {
	t.Helper()

	cfg := config.Config{
		Database: config.DatabaseConfig{
			Path: filepath.Join(t.TempDir(), "nido.db"),
		},
		Auth: config.AuthConfig{
			BootstrapAdminEmail:    "admin@local",
			BootstrapAdminName:     "Local Admin",
			BootstrapAdminPassword: "dev-password",
			SessionTTL:             24 * time.Hour,
		},
		Scheduler: config.SchedulerConfig{
			Enabled:         false,
			LockTTL:         2 * time.Minute,
			ShutdownTimeout: 5 * time.Second,
		},
		Migration: config.MigrationConfig{
			AutoMigrate: true,
			Strategy:    "safe-auto",
			BackupDir:   filepath.Join(t.TempDir(), "backups"),
		},
	}

	runtime, err := New(context.Background(), cfg, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatalf("new runtime: %v", err)
	}

	server := httptest.NewServer(runtime.Handler)
	token := loginTestUser(t, server.URL)
	t.Cleanup(func() {
		_ = runtime.Close()
	})
	return server, token
}

func loginTestUser(t *testing.T, baseURL string) string {
	t.Helper()

	var response struct {
		Token string `json:"token"`
	}
	mustJSONRequest(t, http.MethodPost, baseURL+"/api/v1/auth/login", "", map[string]string{
		"email":    "admin@local",
		"password": "dev-password",
	}, http.StatusOK, &response)
	if response.Token == "" {
		t.Fatal("expected token to be returned")
	}
	return response.Token
}

func mustJSONRequest(t *testing.T, method, targetURL, token string, payload any, wantStatus int, out any) {
	t.Helper()

	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
		body = bytes.NewReader(encoded)
	}

	request, err := http.NewRequest(method, targetURL, body)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read response body: %v", err)
	}
	if response.StatusCode != wantStatus {
		t.Fatalf("unexpected status %d, expected %d, body=%s", response.StatusCode, wantStatus, string(responseBody))
	}
	if out != nil {
		if err := json.Unmarshal(responseBody, out); err != nil {
			t.Fatalf("decode response: %v", err)
		}
	}
}
