/**
 * File: internal/fetcher/client.go
 *
 * Purpose:
 * Provides outbound HTTP fetching, anti-bot handling, and fetch telemetry support.
 *
 * Responsibilities:
 * - Provide package-specific backend behavior
 * - Keep dependencies explicit
 * - Return deterministic values to callers
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - bytes
 * - context
 * - errors
 * - fmt
 * - io
 * - log/slog
 * - net
 * - net/http
 * - net/http/cookiejar
 * - net/url
 * - strings
 * - sync
 * - time
 * - github.com/sony/gobreaker
 * - nido/server/internal/engine
 * - nido/server/internal/ingestion/browser
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package fetcher

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/sony/gobreaker"

	"nido/server/internal/engine"
	"nido/server/internal/ingestion/browser"
)

/**
 * Purpose:
 * Defines the HTTPClient struct used by this package and its consumers.
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
type HTTPClient struct {
	client        *http.Client
	renderer      browser.Renderer
	logger        *slog.Logger
	proxyProvider string
	profiles      []SessionProfile
	config        Config

	breakersMu sync.Mutex
	breakers   map[string]*gobreaker.CircuitBreaker

	metricsMu     sync.Mutex
	domainMetrics map[string]*domainTelemetry
	proxyMetrics  map[string]*proxyTelemetry
	buffers       sync.Pool

	requestGapMu  sync.Mutex
	lastRequestAt map[string]time.Time
}

/**
 * Purpose:
 * Performs the New operation for this backend package.
 *
 * Parameters:
 * - cfg Config, renderer browser.Renderer
 *
 * Returns:
 * - *HTTPClient
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
func New(cfg Config, renderer browser.Renderer) *HTTPClient {
	resolvedClient := cfg.HTTPClient
	if resolvedClient == nil {
		timeout := cfg.Timeout
		if timeout <= 0 {
			timeout = 20 * time.Second
		}
		jar, _ := cookiejar.New(nil)
		resolvedClient = &http.Client{
			Timeout:   timeout,
			Transport: newTransport(cfg),
			Jar:       jar,
		}
	}

	proxyProvider := strings.TrimSpace(cfg.ProxyProvider)
	if proxyProvider == "" {
		proxyProvider = "direct"
	}

	return &HTTPClient{
		client:        resolvedClient,
		renderer:      renderer,
		logger:        cfg.Logger,
		proxyProvider: proxyProvider,
		profiles:      cfg.Profiles,
		config:        cfg,
		breakers:      make(map[string]*gobreaker.CircuitBreaker),
		domainMetrics: make(map[string]*domainTelemetry),
		proxyMetrics:  make(map[string]*proxyTelemetry),
		lastRequestAt: make(map[string]time.Time),
		buffers: sync.Pool{New: func() any {
			return bytes.NewBuffer(make([]byte, 0, 32*1024))
		}},
	}
}

/**
 * Purpose:
 * Performs the Fetch operation for this backend package.
 *
 * Parameters:
 * - c *HTTPClient
 *
 * Returns:
 * - Fetch(ctx context.Context, request Request) (Response, error)
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
func (c *HTTPClient) Fetch(ctx context.Context, request Request) (Response, error) {
	domain := hostForURL(request.URL)
	profile := profileFor(c.profiles, request.SessionKey)
	startedAt := time.Now()

	if err := c.waitForDomainGap(ctx, domain); err != nil {
		c.recordTelemetry(domain, c.proxyProvider, time.Since(startedAt), 0, false)
		return Response{}, err
	}

	if request.BrowserEnabled {
		response, err := c.renderPage(ctx, request.URL, request.DefaultContentType, domain, startedAt)
		if err != nil {
			c.recordTelemetry(domain, c.proxyProvider, time.Since(startedAt), 0, false)
			return Response{}, err
		}
		c.recordTelemetry(domain, c.proxyProvider, response.Latency, response.BytesProcessed, true)
		return response, nil
	}

	breaker := c.breaker(domain)
	result, err := breaker.Execute(func() (any, error) {
		response, err := c.fetchHTTP(ctx, request, domain, profile, startedAt)
		if err == nil {
			return response, nil
		}

		var challengeErr *antiBotChallengeError
		if request.BrowserFallbackOnChallenge && c.renderer != nil && errorsAs(err, &challengeErr) {
			return c.renderPage(ctx, request.URL, request.DefaultContentType, domain, startedAt)
		}

		return Response{}, err
	})
	if err != nil {
		classified := c.classifyCircuitError(err)
		c.recordTelemetry(domain, c.proxyProvider, time.Since(startedAt), 0, false)
		return Response{}, classified
	}

	response := result.(Response)
	c.recordTelemetry(domain, response.ProxyProvider, response.Latency, response.BytesProcessed, true)
	return response, nil
}

/**
 * Purpose:
 * Performs the renderPage operation for this backend package.
 *
 * Parameters:
 * - c *HTTPClient
 *
 * Returns:
 * - renderPage(ctx context.Context, requestURL, defaultType, domain string, startedAt time.Time) (Response, error)
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
func (c *HTTPClient) renderPage(ctx context.Context, requestURL, defaultType, domain string, startedAt time.Time) (Response, error) {
	if c.renderer == nil {
		return Response{}, engine.Fatal(fmt.Errorf("browser rendering is not configured for %q", requestURL))
	}

	payload, err := c.renderer.Render(ctx, requestURL)
	if err != nil {
		return Response{}, c.classifyTransportError(ctx, fmt.Errorf("render source payload: %w", err))
	}
	if marker := detectAntiBotChallenge(payload); marker != "" {
		return Response{}, engine.Retryable(&antiBotChallengeError{marker: marker, via: "browser"})
	}

	return Response{
		Payload:        payload,
		ContentType:    defaultContentType("text/html; charset=utf-8", defaultType),
		FetchedAt:      time.Now().UTC(),
		BytesProcessed: len(payload),
		Domain:         domain,
		ProxyProvider:  c.proxyProvider,
		Latency:        time.Since(startedAt),
	}, nil
}

/**
 * Purpose:
 * Performs the fetchHTTP operation for this backend package.
 *
 * Parameters:
 * - c *HTTPClient
 *
 * Returns:
 * - fetchHTTP(ctx context.Context, request Request, domain string, profile SessionProfile, startedAt time.Time) (Response, error)
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
func (c *HTTPClient) fetchHTTP(ctx context.Context, request Request, domain string, profile SessionProfile, startedAt time.Time) (Response, error) {
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, request.URL, nil)
	if err != nil {
		return Response{}, engine.Fatal(fmt.Errorf("build request: %w", err))
	}

	accept := strings.TrimSpace(request.Accept)
	if accept == "" {
		accept = profile.Accept
	}
	if accept != "" {
		httpRequest.Header.Set("Accept", accept)
	}
	if profile.AcceptLanguage != "" {
		httpRequest.Header.Set("Accept-Language", profile.AcceptLanguage)
	}
	if profile.UserAgent != "" {
		httpRequest.Header.Set("User-Agent", profile.UserAgent)
	}
	if profile.SecCHUA != "" {
		httpRequest.Header.Set("Sec-CH-UA", profile.SecCHUA)
		httpRequest.Header.Set("Sec-CH-UA-Mobile", "?0")
	}
	if profile.SecCHUAPlatform != "" {
		httpRequest.Header.Set("Sec-CH-UA-Platform", profile.SecCHUAPlatform)
	}
	if profile.SecFetchDest != "" {
		httpRequest.Header.Set("Sec-Fetch-Dest", profile.SecFetchDest)
	}
	if profile.SecFetchMode != "" {
		httpRequest.Header.Set("Sec-Fetch-Mode", profile.SecFetchMode)
	}
	if profile.SecFetchSite != "" {
		httpRequest.Header.Set("Sec-Fetch-Site", profile.SecFetchSite)
	}
	if profile.SecFetchMode == "navigate" {
		httpRequest.Header.Set("Sec-Fetch-User", "?1")
	}
	if profile.UpgradeInsecureRequests != "" {
		httpRequest.Header.Set("Upgrade-Insecure-Requests", profile.UpgradeInsecureRequests)
	}
	for name, value := range request.Headers {
		trimmedName := strings.TrimSpace(name)
		trimmedValue := strings.TrimSpace(value)
		if trimmedName == "" || trimmedValue == "" {
			continue
		}
		httpRequest.Header.Set(trimmedName, trimmedValue)
	}

	response, err := c.client.Do(httpRequest)
	if err != nil {
		return Response{}, c.classifyTransportError(ctx, fmt.Errorf("fetch source payload: %w", err))
	}
	defer drainAndClose(response.Body)

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return Response{}, engine.WrapHTTPStatus(response.Status, response.StatusCode)
	}

	payload, bytesProcessed, err := c.readPayload(response.Body)
	if err != nil {
		return Response{}, c.classifyTransportError(ctx, fmt.Errorf("read source payload: %w", err))
	}
	if marker := detectAntiBotChallenge(payload); marker != "" {
		return Response{}, engine.Retryable(&antiBotChallengeError{marker: marker, via: "http"})
	}

	return Response{
		Payload:        payload,
		ContentType:    defaultContentType(response.Header.Get("Content-Type"), request.DefaultContentType),
		FetchedAt:      time.Now().UTC(),
		BytesProcessed: bytesProcessed,
		Domain:         domain,
		ProxyProvider:  c.proxyProvider,
		Latency:        time.Since(startedAt),
	}, nil
}

/**
 * Purpose:
 * Performs the waitForDomainGap operation for this backend package.
 *
 * Parameters:
 * - c *HTTPClient
 *
 * Returns:
 * - waitForDomainGap(ctx context.Context, domain string) error
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
func (c *HTTPClient) waitForDomainGap(ctx context.Context, domain string) error {
	if c.config.MinRequestGap <= 0 {
		return nil
	}

	resolvedDomain := strings.TrimSpace(domain)
	if resolvedDomain == "" {
		resolvedDomain = "unknown"
	}

	now := time.Now()
	reservedAt := now

	c.requestGapMu.Lock()
	if last, ok := c.lastRequestAt[resolvedDomain]; ok {
		next := last.Add(c.config.MinRequestGap)
		if next.After(reservedAt) {
			reservedAt = next
		}
	}
	c.lastRequestAt[resolvedDomain] = reservedAt
	c.requestGapMu.Unlock()

	delay := time.Until(reservedAt)
	if delay <= 0 {
		return nil
	}

	timer := time.NewTimer(delay)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return engine.Fatal(ctx.Err())
	case <-timer.C:
		return nil
	}
}

/**
 * Purpose:
 * Performs the breaker operation for this backend package.
 *
 * Parameters:
 * - c *HTTPClient
 *
 * Returns:
 * - breaker(domain string) *gobreaker.CircuitBreaker
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
func (c *HTTPClient) breaker(domain string) *gobreaker.CircuitBreaker {
	resolvedDomain := strings.TrimSpace(domain)
	if resolvedDomain == "" {
		resolvedDomain = "unknown"
	}

	c.breakersMu.Lock()
	defer c.breakersMu.Unlock()
	breaker := c.breakers[resolvedDomain]
	if breaker != nil {
		return breaker
	}

	interval := c.config.BreakerInterval
	if interval <= 0 {
		interval = 30 * time.Second
	}
	timeout := c.config.BreakerTimeout
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	breaker = gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        resolvedDomain,
		Interval:    interval,
		Timeout:     timeout,
		MaxRequests: 1,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 5
		},
	})
	c.breakers[resolvedDomain] = breaker
	return breaker
}

/**
 * Purpose:
 * Performs the classifyTransportError operation for this backend package.
 *
 * Parameters:
 * - c *HTTPClient
 *
 * Returns:
 * - classifyTransportError(ctx context.Context, err error) error
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
func (c *HTTPClient) classifyTransportError(ctx context.Context, err error) error {
	if err == nil {
		return nil
	}
	if ctx.Err() != nil {
		return engine.Fatal(ctx.Err())
	}
	if strings.Contains(strings.ToLower(err.Error()), "not configured") {
		return engine.Fatal(err)
	}
	var urlErr *url.Error
	if strings.Contains(strings.ToLower(err.Error()), "timeout") || (errorsAs(err, &urlErr) && urlErr.Timeout()) {
		return engine.Retryable(err)
	}
	var netErr net.Error
	if errorsAs(err, &netErr) && (netErr.Timeout() || netErr.Temporary()) {
		return engine.Retryable(err)
	}

	return engine.Retryable(err)
}

/**
 * Purpose:
 * Performs the classifyCircuitError operation for this backend package.
 *
 * Parameters:
 * - c *HTTPClient
 *
 * Returns:
 * - classifyCircuitError(err error) error
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
func (c *HTTPClient) classifyCircuitError(err error) error {
	if err == nil {
		return nil
	}
	if err == gobreaker.ErrOpenState || err == gobreaker.ErrTooManyRequests {
		return engine.Retryable(err)
	}
	if _, ok := err.(*engine.ClassifiedError); ok {
		return err
	}

	return engine.Retryable(err)
}

/**
 * Purpose:
 * Performs the hostForURL operation for this backend package.
 *
 * Parameters:
 * - raw string
 *
 * Returns:
 * - string
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
func hostForURL(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return ""
	}

	return parsed.Hostname()
}

/**
 * Purpose:
 * Performs the defaultContentType operation for this backend package.
 *
 * Parameters:
 * - received, fallback string
 *
 * Returns:
 * - string
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
func defaultContentType(received, fallback string) string {
	if strings.TrimSpace(received) != "" {
		return received
	}
	if strings.TrimSpace(fallback) != "" {
		return strings.TrimSpace(fallback)
	}

	return "application/octet-stream"
}

/**
 * Purpose:
 * Performs the drainAndClose operation for this backend package.
 *
 * Parameters:
 * - body io.ReadCloser
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
func drainAndClose(body io.ReadCloser) {
	if body == nil {
		return
	}
	_, _ = io.Copy(io.Discard, body)
	_ = body.Close()
}

/**
 * Purpose:
 * Performs the errorsAs operation for this backend package.
 *
 * Parameters:
 * - err error, target any
 *
 * Returns:
 * - bool
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
func errorsAs(err error, target any) bool {
	return errors.As(err, target)
}
