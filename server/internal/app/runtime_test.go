package app

import (
	"bufio"
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

	"home-searcher/server/internal/platform/config"
)

func TestRuntimeIngestAndCatalogFlow(t *testing.T) {
	t.Parallel()

	feedPayload := `{"items":[{"external_id":"flat-001","title":"Sunny flat","price_amount":250000,"currency":"EUR","location":"Bilbao","url":"https://example.test/listings/flat-001"},{"external_id":"house-002","title":"Town house","price_amount":390000,"currency":"EUR","location":"Getxo","url":"https://example.test/listings/house-002"}]}`
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, feedPayload)
	}))
	defer upstream.Close()

	cfg := newTestConfig(t, upstream.URL)
	runtime := newTestRuntime(t, cfg)
	defer runtime.Close()

	server := httptest.NewServer(runtime.Handler)
	defer server.Close()
	token := loginTestUser(t, server.URL, cfg.Auth.BootstrapAdminEmail, cfg.Auth.BootstrapAdminPassword)

	response := mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/health/ready", "", nil)
	assertStatus(t, response, http.StatusOK)

	response = mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/sources", token, nil)
	assertStatus(t, response, http.StatusOK)

	var sourcePayload struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	decodeJSON(t, response.Body, &sourcePayload)
	if len(sourcePayload.Items) != 1 || sourcePayload.Items[0].ID != "bootstrap-feed" {
		t.Fatalf("unexpected sources payload: %+v", sourcePayload.Items)
	}

	response = mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/sources/bootstrap-feed/ingest", token, nil)
	assertStatus(t, response, http.StatusOK)

	var ingestPayload struct {
		Item struct {
			Status      string `json:"status"`
			ItemCount   int    `json:"item_count"`
			ArtifactKey string `json:"artifact_key"`
		} `json:"item"`
	}
	decodeJSON(t, response.Body, &ingestPayload)
	if ingestPayload.Item.Status != "completed" {
		t.Fatalf("unexpected run status %q", ingestPayload.Item.Status)
	}
	if ingestPayload.Item.ItemCount != 2 {
		t.Fatalf("unexpected item count %d", ingestPayload.Item.ItemCount)
	}
	if ingestPayload.Item.ArtifactKey == "" {
		t.Fatal("expected artifact key to be set")
	}

	response = mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/runs?source_id=bootstrap-feed", token, nil)
	assertStatus(t, response, http.StatusOK)

	var runsPayload struct {
		Count int `json:"count"`
	}
	decodeJSON(t, response.Body, &runsPayload)
	if runsPayload.Count != 1 {
		t.Fatalf("unexpected run count %d", runsPayload.Count)
	}

	response = mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/listings", "", nil)
	assertStatus(t, response, http.StatusOK)

	var listingsPayload struct {
		Items []struct {
			ID          string `json:"id"`
			PriceAmount int64  `json:"price_amount"`
		} `json:"items"`
		Count int `json:"count"`
	}
	decodeJSON(t, response.Body, &listingsPayload)
	if listingsPayload.Count != 2 {
		t.Fatalf("unexpected listing count %d", listingsPayload.Count)
	}
	if listingsPayload.Items[0].ID == "" {
		t.Fatal("expected listing id to be populated")
	}

	response = mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/listings/"+listingsPayload.Items[0].ID, "", nil)
	assertStatus(t, response, http.StatusOK)

	var detailPayload struct {
		Item struct {
			ID string `json:"id"`
		} `json:"item"`
		PriceHistory []any `json:"price_history"`
	}
	decodeJSON(t, response.Body, &detailPayload)
	if detailPayload.Item.ID == "" {
		t.Fatal("expected listing detail id to be populated")
	}
	if len(detailPayload.PriceHistory) != 0 {
		t.Fatalf("expected empty price history, got %d entries", len(detailPayload.PriceHistory))
	}
}

func TestRuntimeRecordsPriceChangeAcrossRepeatedIngests(t *testing.T) {
	t.Parallel()

	feedPayload := `{"items":[{"external_id":"flat-001","title":"Sunny flat","price_amount":250000,"currency":"EUR","location":"Bilbao","url":"https://example.test/listings/flat-001"}]}`
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, feedPayload)
	}))
	defer upstream.Close()

	cfg := newTestConfig(t, upstream.URL)
	runtime := newTestRuntime(t, cfg)
	defer runtime.Close()

	server := httptest.NewServer(runtime.Handler)
	defer server.Close()
	token := loginTestUser(t, server.URL, cfg.Auth.BootstrapAdminEmail, cfg.Auth.BootstrapAdminPassword)

	response := mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/sources/bootstrap-feed/ingest", token, nil)
	assertStatus(t, response, http.StatusOK)

	feedPayload = `{"items":[{"external_id":"flat-001","title":"Sunny flat","price_amount":265000,"currency":"EUR","location":"Bilbao","url":"https://example.test/listings/flat-001"}]}`
	response = mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/sources/bootstrap-feed/ingest", token, nil)
	assertStatus(t, response, http.StatusOK)

	response = mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/listings", "", nil)
	assertStatus(t, response, http.StatusOK)

	var listingsPayload struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	decodeJSON(t, response.Body, &listingsPayload)

	response = mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/listings/"+listingsPayload.Items[0].ID, "", nil)
	assertStatus(t, response, http.StatusOK)

	var detailPayload struct {
		PriceHistory []struct {
			PreviousAmount *int64 `json:"previous_amount"`
			NewAmount      int64  `json:"new_amount"`
		} `json:"price_history"`
	}
	decodeJSON(t, response.Body, &detailPayload)
	if len(detailPayload.PriceHistory) != 1 {
		t.Fatalf("expected one price history item, got %d", len(detailPayload.PriceHistory))
	}
	if detailPayload.PriceHistory[0].PreviousAmount == nil || *detailPayload.PriceHistory[0].PreviousAmount != 250000 {
		t.Fatalf("unexpected previous amount: %+v", detailPayload.PriceHistory[0].PreviousAmount)
	}
	if detailPayload.PriceHistory[0].NewAmount != 265000 {
		t.Fatalf("unexpected new amount %d", detailPayload.PriceHistory[0].NewAmount)
	}
}

func TestRuntimeUserFeaturesAndNotifications(t *testing.T) {
	t.Parallel()

	feedPayload := `{"items":[{"external_id":"flat-001","title":"Sunny flat","price_amount":250000,"currency":"EUR","location":"Bilbao","url":"https://example.test/listings/flat-001"}]}`
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, feedPayload)
	}))
	defer upstream.Close()

	cfg := newTestConfig(t, upstream.URL)
	runtime := newTestRuntime(t, cfg)
	defer runtime.Close()

	server := httptest.NewServer(runtime.Handler)
	defer server.Close()
	token := loginTestUser(t, server.URL, cfg.Auth.BootstrapAdminEmail, cfg.Auth.BootstrapAdminPassword)

	response := mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/me/watchlists", token, map[string]any{
		"name":  "Bilbao picks",
		"query": "sunny",
	})
	assertStatus(t, response, http.StatusCreated)

	var watchlistPayload struct {
		Item struct {
			ID string `json:"id"`
		} `json:"item"`
	}
	decodeJSON(t, response.Body, &watchlistPayload)

	response = mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/me/alert-rules", token, map[string]any{
		"watchlist_id": watchlistPayload.Item.ID,
		"rule_type":    "new_listing",
	})
	assertStatus(t, response, http.StatusCreated)

	response = mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/sources/bootstrap-feed/ingest", token, nil)
	assertStatus(t, response, http.StatusOK)

	response = mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/me/notifications", token, nil)
	assertStatus(t, response, http.StatusOK)

	var notificationsPayload struct {
		Items []struct {
			ID   string `json:"id"`
			Kind string `json:"kind"`
		} `json:"items"`
		Count int `json:"count"`
	}
	decodeJSON(t, response.Body, &notificationsPayload)
	if notificationsPayload.Count != 1 || notificationsPayload.Items[0].Kind != "new_listing" {
		t.Fatalf("unexpected notifications after first ingest: %+v", notificationsPayload.Items)
	}

	response = mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/listings", "", nil)
	assertStatus(t, response, http.StatusOK)

	var listingsPayload struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	decodeJSON(t, response.Body, &listingsPayload)
	listingID := listingsPayload.Items[0].ID

	response = mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/me/bookmarks", token, map[string]any{"listing_id": listingID})
	assertStatus(t, response, http.StatusCreated)

	response = mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/me/bookmarks", token, nil)
	assertStatus(t, response, http.StatusOK)

	var bookmarksPayload struct {
		Count int `json:"count"`
	}
	decodeJSON(t, response.Body, &bookmarksPayload)
	if bookmarksPayload.Count != 1 {
		t.Fatalf("unexpected bookmark count %d", bookmarksPayload.Count)
	}

	response = mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/me/alert-rules", token, map[string]any{
		"listing_id": listingID,
		"rule_type":  "price_drop",
	})
	assertStatus(t, response, http.StatusCreated)

	feedPayload = `{"items":[{"external_id":"flat-001","title":"Sunny flat","price_amount":225000,"currency":"EUR","location":"Bilbao","url":"https://example.test/listings/flat-001"}]}`
	response = mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/sources/bootstrap-feed/ingest", token, nil)
	assertStatus(t, response, http.StatusOK)

	response = mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/me/notifications", token, nil)
	assertStatus(t, response, http.StatusOK)
	decodeJSON(t, response.Body, &notificationsPayload)
	if notificationsPayload.Count < 2 {
		t.Fatalf("expected at least two notifications, got %d", notificationsPayload.Count)
	}

	hasPriceDrop := false
	for _, item := range notificationsPayload.Items {
		if item.Kind == "price_drop" {
			hasPriceDrop = true
		}
	}
	if !hasPriceDrop {
		t.Fatal("expected a price_drop notification")
	}

	response = mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/me/notifications/"+notificationsPayload.Items[0].ID+"/read", token, nil)
	assertStatus(t, response, http.StatusOK)
}

func TestRuntimeCreateSourceReturnsNormalizedPayload(t *testing.T) {
	t.Parallel()

	cfg := newTestConfig(t, "")
	runtime := newTestRuntime(t, cfg)
	defer runtime.Close()

	server := httptest.NewServer(runtime.Handler)
	defer server.Close()
	token := loginTestUser(t, server.URL, cfg.Auth.BootstrapAdminEmail, cfg.Auth.BootstrapAdminPassword)

	response := mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/sources", token, map[string]any{
		"active":       true,
		"endpoint_url": "https://example.test/manual-feed.json",
		"id":           "manual-feed",
		"kind":         "http-json-feed",
		"name":         "Manual Feed",
	})
	assertStatus(t, response, http.StatusCreated)

	var payload struct {
		Item struct {
			ConfigJSON string `json:"config_json"`
			CreatedAt  string `json:"created_at"`
			UpdatedAt  string `json:"updated_at"`
		} `json:"item"`
	}
	decodeJSON(t, response.Body, &payload)

	if payload.Item.ConfigJSON != "{}" {
		t.Fatalf("expected normalized config json, got %q", payload.Item.ConfigJSON)
	}
	if payload.Item.CreatedAt == "" || payload.Item.UpdatedAt == "" {
		t.Fatalf("expected normalized timestamps, got created=%q updated=%q", payload.Item.CreatedAt, payload.Item.UpdatedAt)
	}
}

func TestRuntimeHTMLJSONLDSourceFlow(t *testing.T) {
	t.Parallel()

	htmlPayload := `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"@type":"ListItem","item":{"@type":"Product","name":"Harbor Loft","url":"https://portal.test/listings/loft-01","identifier":"loft-01","offers":{"price":"310000","priceCurrency":"EUR"},"address":{"addressLocality":"Bilbao"}}}]}</script></head><body></body></html>`
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = io.WriteString(w, htmlPayload)
	}))
	defer upstream.Close()

	cfg := newTestConfig(t, "")
	runtime := newTestRuntime(t, cfg)
	defer runtime.Close()

	server := httptest.NewServer(runtime.Handler)
	defer server.Close()
	token := loginTestUser(t, server.URL, cfg.Auth.BootstrapAdminEmail, cfg.Auth.BootstrapAdminPassword)

	response := mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/sources", token, map[string]any{
		"id":           "portal-html",
		"name":         "Portal HTML",
		"kind":         "html-jsonld",
		"endpoint_url": upstream.URL,
		"active":       true,
	})
	assertStatus(t, response, http.StatusCreated)

	response = mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/sources/portal-html/ingest", token, nil)
	assertStatus(t, response, http.StatusOK)

	response = mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/listings?source_id=portal-html", "", nil)
	assertStatus(t, response, http.StatusOK)

	var listingsPayload struct {
		Items []struct {
			Title       string `json:"title"`
			Location    string `json:"location"`
			PriceAmount int64  `json:"price_amount"`
		} `json:"items"`
		Count int `json:"count"`
	}
	decodeJSON(t, response.Body, &listingsPayload)
	if listingsPayload.Count != 1 {
		t.Fatalf("unexpected listing count %d", listingsPayload.Count)
	}
	if listingsPayload.Items[0].Title != "Harbor Loft" || listingsPayload.Items[0].Location != "Bilbao" || listingsPayload.Items[0].PriceAmount != 310000 {
		t.Fatalf("unexpected html connector listing payload: %+v", listingsPayload.Items[0])
	}
}

func TestRuntimeHTMLListingsSourceFlow(t *testing.T) {
	t.Parallel()

	htmlPayload := `<html><body><article class="item" data-element-id="110924150"><a class="item-link" href="/ca/inmueble/110924150/">Pis a Palau, Girona</a><span class="item-price h2-simulated">180.000<span class="txt-big">€</span></span></article></body></html>`
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = io.WriteString(w, htmlPayload)
	}))
	defer upstream.Close()

	cfg := newTestConfig(t, "")
	runtime := newTestRuntime(t, cfg)
	defer runtime.Close()

	server := httptest.NewServer(runtime.Handler)
	defer server.Close()
	token := loginTestUser(t, server.URL, cfg.Auth.BootstrapAdminEmail, cfg.Auth.BootstrapAdminPassword)

	response := mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/sources", token, map[string]any{
		"id":              "idealista-html",
		"name":            "Idealista HTML",
		"kind":            "html-listings",
		"endpoint_url":    upstream.URL,
		"browser_enabled": false,
		"active":          true,
		"config_json":     `{"item_selector":"article.item","title_selector":"a.item-link","url_selector":"a.item-link","price_selector":".item-price","external_id_attribute":"data-element-id","base_url":"https://www.idealista.com","currency":"EUR"}`,
	})
	assertStatus(t, response, http.StatusCreated)

	response = mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/sources/idealista-html/ingest", token, nil)
	assertStatus(t, response, http.StatusOK)

	response = mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/listings?source_id=idealista-html", "", nil)
	assertStatus(t, response, http.StatusOK)

	var listingsPayload struct {
		Items []struct {
			Title       string `json:"title"`
			Location    string `json:"location"`
			PriceAmount int64  `json:"price_amount"`
			URL         string `json:"url"`
		} `json:"items"`
		Count int `json:"count"`
	}
	decodeJSON(t, response.Body, &listingsPayload)
	if listingsPayload.Count != 1 {
		t.Fatalf("unexpected listing count %d", listingsPayload.Count)
	}
	if listingsPayload.Items[0].Title != "Pis a Palau, Girona" || listingsPayload.Items[0].PriceAmount != 180000 || listingsPayload.Items[0].URL != "https://www.idealista.com/ca/inmueble/110924150/" {
		t.Fatalf("unexpected html listings payload: %+v", listingsPayload.Items[0])
	}
}

func TestRuntimeSchedulerIngestsDueSource(t *testing.T) {
	t.Parallel()

	feedPayload := `{"items":[{"external_id":"flat-001","title":"Sunny flat","price_amount":250000,"currency":"EUR","location":"Bilbao","url":"https://example.test/listings/flat-001"}]}`
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, feedPayload)
	}))
	defer upstream.Close()

	cfg := newTestConfig(t, upstream.URL)
	cfg.Scheduler.Enabled = true
	cfg.Scheduler.TickInterval = 20 * time.Millisecond
	cfg.Scheduler.BatchSize = 1
	cfg.BootstrapSource.ScheduleIntervalSeconds = 1
	runtime := newTestRuntime(t, cfg)
	defer runtime.Close()

	server := httptest.NewServer(runtime.Handler)
	defer server.Close()
	token := loginTestUser(t, server.URL, cfg.Auth.BootstrapAdminEmail, cfg.Auth.BootstrapAdminPassword)

	pollUntil(t, 2*time.Second, func() (bool, error) {
		response := mustJSONRequest(t, http.MethodGet, server.URL+"/api/v1/backoffice/runs?source_id=bootstrap-feed", token, nil)
		assertStatus(t, response, http.StatusOK)

		var runsPayload struct {
			Count int `json:"count"`
		}
		decodeJSON(t, response.Body, &runsPayload)
		return runsPayload.Count >= 1, nil
	})
}

func TestRuntimeBackofficeEventsStream(t *testing.T) {
	t.Parallel()

	feedPayload := `{"items":[{"external_id":"flat-001","title":"Sunny flat","price_amount":250000,"currency":"EUR","location":"Bilbao","url":"https://example.test/listings/flat-001"}]}`
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, feedPayload)
	}))
	defer upstream.Close()

	cfg := newTestConfig(t, upstream.URL)
	runtime := newTestRuntime(t, cfg)
	defer runtime.Close()

	server := httptest.NewServer(runtime.Handler)
	defer server.Close()
	token := loginTestUser(t, server.URL, cfg.Auth.BootstrapAdminEmail, cfg.Auth.BootstrapAdminPassword)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/api/v1/backoffice/events", nil)
	if err != nil {
		t.Fatalf("build stream request: %v", err)
	}
	request.Header.Set("Authorization", "Bearer "+token)

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("open event stream: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		t.Fatalf("unexpected event stream status %d: %s", response.StatusCode, string(body))
	}

	eventsSeen := make(chan string, 1)
	go func() {
		scanner := bufio.NewScanner(response.Body)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "event: ") {
				eventType := strings.TrimSpace(strings.TrimPrefix(line, "event: "))
				if eventType == "ingestion.run.completed" {
					eventsSeen <- eventType
					return
				}
			}
		}
		eventsSeen <- ""
	}()

	response = mustJSONRequest(t, http.MethodPost, server.URL+"/api/v1/backoffice/sources/bootstrap-feed/ingest", token, nil)
	assertStatus(t, response, http.StatusOK)

	select {
	case eventType := <-eventsSeen:
		if eventType != "ingestion.run.completed" {
			t.Fatalf("unexpected stream event %q", eventType)
		}
	case <-ctx.Done():
		t.Fatal("timed out waiting for stream event")
	}
}

func newTestConfig(t *testing.T, sourceURL string) config.Config {
	t.Helper()

	return config.Config{
		HTTP: config.HTTPConfig{Address: ":0"},
		Database: config.DatabaseConfig{
			Path: filepath.Join(t.TempDir(), "home-searcher.db"),
		},
		ObjectStore: config.ObjectStoreConfig{Driver: "memory"},
		Scheduler:   config.SchedulerConfig{Enabled: false, TickInterval: 50 * time.Millisecond, LockTTL: time.Second, BatchSize: 1},
		Auth: config.AuthConfig{
			BootstrapAdminEmail:    "admin@example.test",
			BootstrapAdminName:     "Test Admin",
			BootstrapAdminPassword: "test-password",
			SessionTTL:             time.Hour,
		},
		BootstrapSource: config.BootstrapSourceConfig{
			ID:               "bootstrap-feed",
			Name:             "Bootstrap Feed",
			Kind:             "http-json-feed",
			EndpointURL:      sourceURL,
			ConfigJSON:       "{}",
			RetryMaxAttempts: 1,
		},
	}
}

func newTestRuntime(t *testing.T, cfg config.Config) *Runtime {
	t.Helper()

	runtime, err := New(context.Background(), cfg, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatalf("build runtime: %v", err)
	}

	return runtime
}

func loginTestUser(t *testing.T, baseURL, email, password string) string {
	t.Helper()

	response := mustJSONRequest(t, http.MethodPost, baseURL+"/api/v1/auth/login", "", map[string]string{
		"email":    email,
		"password": password,
	})
	assertStatus(t, response, http.StatusOK)

	var payload struct {
		Token string `json:"token"`
	}
	decodeJSON(t, response.Body, &payload)
	if payload.Token == "" {
		t.Fatal("expected auth token to be returned")
	}

	return payload.Token
}

func mustJSONRequest(t *testing.T, method, url, token string, body any) *http.Response {
	t.Helper()

	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request body: %v", err)
		}
		reader = bytes.NewReader(payload)
	}

	request, err := http.NewRequestWithContext(context.Background(), method, url, reader)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if strings.TrimSpace(token) != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("send request: %v", err)
	}

	return response
}

func assertStatus(t *testing.T, response *http.Response, expected int) {
	t.Helper()

	if response.StatusCode != expected {
		body, _ := io.ReadAll(response.Body)
		_ = response.Body.Close()
		t.Fatalf("unexpected status %d, expected %d, body=%s", response.StatusCode, expected, string(body))
	}
}

func decodeJSON(t *testing.T, body io.ReadCloser, target any) {
	t.Helper()
	defer body.Close()

	if err := json.NewDecoder(body).Decode(target); err != nil {
		t.Fatalf("decode json: %v", err)
	}
}

func pollUntil(t *testing.T, timeout time.Duration, fn func() (bool, error)) {
	t.Helper()

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		done, err := fn()
		if err != nil {
			t.Fatalf("poll failed: %v", err)
		}
		if done {
			return
		}
		time.Sleep(25 * time.Millisecond)
	}

	t.Fatalf("condition not met within %s", timeout)
}
