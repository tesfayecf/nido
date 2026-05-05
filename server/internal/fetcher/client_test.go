/**
 * File: internal/fetcher/client_test.go
 *
 * Purpose:
 * Validates the fetcher package behavior covered by client_test.go.
 *
 * Responsibilities:
 * - Set up deterministic test fixtures
 * - Exercise expected success and failure paths
 * - Protect backend behavior from regressions
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - context
 * - net/http
 * - net/http/httptest
 * - strings
 * - sync/atomic
 * - testing
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package fetcher

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

/**
 * Purpose:
 * Defines the rendererStub struct used by this package and its consumers.
 *
 * Parameters:
 * - None; callers construct or receive this type through package APIs.
 *
 * Returns:
 * - Not applicable; this declaration describes data or behavior shape.
 *
 * Logic Summary:
 * - Centralizes field, method, or contract shape shared across the backend layer.
 *
 * Edge Cases:
 * - Keep field names, JSON tags, and persistence assumptions synchronized with downstream consumers.
 */
type rendererStub struct {
	payload []byte
	err     error
	calls   atomic.Int32
}

/**
 * Purpose:
 * Performs the Render operation for this backend package.
 *
 * Parameters:
 * - r *rendererStub
 *
 * Returns:
 * - Render(_ context.Context, _ string) ([]byte, error)
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
func (r *rendererStub) Render(_ context.Context, _ string) ([]byte, error) {
	r.calls.Add(1)
	return r.payload, r.err
}

/**
 * Purpose:
 * Performs the TestHTTPClientFallsBackToBrowserOnChallenge operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
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
func TestHTTPClientFallsBackToBrowserOnChallenge(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<html><head><title>Just a moment...</title></head><body>Cloudflare Ray ID: abc123</body></html>`))
	}))
	defer server.Close()

	renderer := &rendererStub{payload: []byte(`<html><body><main>real listing html</main></body></html>`)}
	client := New(Config{}, renderer)

	response, err := client.Fetch(context.Background(), Request{
		URL:                        server.URL,
		DefaultContentType:         "text/html; charset=utf-8",
		BrowserFallbackOnChallenge: true,
		SessionKey:                 "source-1",
	})
	if err != nil {
		t.Fatalf("expected browser fallback to succeed, got %v", err)
	}
	if !strings.Contains(string(response.Payload), "real listing html") {
		t.Fatalf("expected browser payload, got %q", string(response.Payload))
	}
	if renderer.calls.Load() != 1 {
		t.Fatalf("expected one browser render, got %d", renderer.calls.Load())
	}
}

/**
 * Purpose:
 * Performs the TestHTTPClientPersistsCookiesAcrossRequests operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
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
func TestHTTPClientPersistsCookiesAcrossRequests(t *testing.T) {
	t.Parallel()

	var seenCookie atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/set") {
			http.SetCookie(w, &http.Cookie{Name: "session", Value: "abc123", Path: "/"})
			_, _ = w.Write([]byte("ok"))
			return
		}

		if cookie, err := r.Cookie("session"); err == nil && cookie.Value == "abc123" {
			seenCookie.Store(true)
		}
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	client := New(Config{}, nil)
	ctx := context.Background()

	if _, err := client.Fetch(ctx, Request{URL: server.URL + "/set", SessionKey: "property-1"}); err != nil {
		t.Fatalf("set cookie fetch: %v", err)
	}
	if _, err := client.Fetch(ctx, Request{URL: server.URL + "/check", SessionKey: "property-1"}); err != nil {
		t.Fatalf("check cookie fetch: %v", err)
	}
	if !seenCookie.Load() {
		t.Fatal("expected follow-up request to reuse persisted cookies")
	}
}

/**
 * Purpose:
 * Performs the TestHTTPClientAppliesBrowserLikeHeaders operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
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
func TestHTTPClientAppliesBrowserLikeHeaders(t *testing.T) {
	t.Parallel()

	headers := make(chan http.Header, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headers <- r.Header.Clone()
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	client := New(Config{
		Profiles: []SessionProfile{
			{
				UserAgent:               "Mozilla/5.0",
				SecCHUA:                 `"Chromium";v="135"`,
				SecCHUAPlatform:         `"Windows"`,
				AcceptLanguage:          "en-US,en;q=0.9",
				SecFetchDest:            "document",
				SecFetchMode:            "navigate",
				SecFetchSite:            "none",
				UpgradeInsecureRequests: "1",
			},
		},
	}, nil)
	if _, err := client.Fetch(context.Background(), Request{URL: server.URL, SessionKey: "property-1"}); err != nil {
		t.Fatalf("fetch: %v", err)
	}

	got := <-headers
	if got.Get("User-Agent") == "" {
		t.Fatal("expected user-agent header")
	}
	if got.Get("Sec-CH-UA-Platform") == "" {
		t.Fatal("expected sec-ch-ua-platform header")
	}
	if got.Get("Sec-Fetch-Mode") != "navigate" {
		t.Fatalf("expected navigate sec-fetch-mode, got %q", got.Get("Sec-Fetch-Mode"))
	}
	if got.Get("Upgrade-Insecure-Requests") != "1" {
		t.Fatalf("expected upgrade-insecure-requests header, got %q", got.Get("Upgrade-Insecure-Requests"))
	}
}
