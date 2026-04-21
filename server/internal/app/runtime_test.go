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
	"testing"
	"time"

	"home-searcher/server/internal/platform/config"
)

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
	if runs.Count != 1 || len(runs.Items) != 1 {
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
	if snapshots.Count != 1 || snapshots.Items[0].Values["title"] != "Sunny flat" {
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

type createdProperty struct {
	ID string `json:"id"`
}

func createSource(t *testing.T, baseURL, token string, payload map[string]any) {
	t.Helper()
	mustJSONRequest(t, http.MethodPost, baseURL+"/api/v1/backoffice/sources", token, payload, http.StatusCreated, nil)
}

func createProperty(t *testing.T, baseURL, token string, payload map[string]any) createdProperty {
	t.Helper()
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
			Path: filepath.Join(t.TempDir(), "home-searcher.db"),
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
