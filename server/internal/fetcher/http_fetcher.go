package fetcher

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Classification describes whether an HTTP response should be retried.
type Classification string

const (
	// ClassificationFatal indicates the request should not be retried.
	ClassificationFatal Classification = "fatal"
	// ClassificationRetryable indicates the request may succeed on retry.
	ClassificationRetryable Classification = "retryable"
)

// HTTPError captures an HTTP failure and whether it is retryable.
type HTTPError struct {
	Classification Classification
	StatusCode     int
	Status         string
}

func (e HTTPError) Error() string {
	return fmt.Sprintf("unexpected source status: %s", e.Status)
}

// Result contains the raw payload returned by a source fetch.
type Result struct {
	ContentType string
	FetchedAt   time.Time
	Payload     []byte
	StatusCode  int
}

// HTTPFetcher retrieves source payloads while reusing buffers and draining bodies.
type HTTPFetcher struct {
	bufferPool         sync.Pool
	client             *http.Client
	defaultContentType string
	logger             *slog.Logger
}

// NewHTTPFetcher builds a reusable HTTP fetcher.
func NewHTTPFetcher(client *http.Client, logger *slog.Logger, defaultContentType string) *HTTPFetcher {
	resolvedClient := client
	if resolvedClient == nil {
		resolvedClient = &http.Client{Timeout: 20 * time.Second}
	}
	if strings.TrimSpace(defaultContentType) == "" {
		defaultContentType = "application/octet-stream"
	}

	return &HTTPFetcher{
		bufferPool: sync.Pool{New: func() any {
			return bytes.NewBuffer(make([]byte, 0, 64*1024))
		}},
		client:             resolvedClient,
		defaultContentType: defaultContentType,
		logger:             logger,
	}
}

// Fetch loads the supplied URL with context cancellation support.
func (f *HTTPFetcher) Fetch(ctx context.Context, endpointURL string, headers http.Header) (Result, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpointURL, nil)
	if err != nil {
		return Result{}, fmt.Errorf("build request: %w", err)
	}
	for key, values := range headers {
		for _, value := range values {
			request.Header.Add(key, value)
		}
	}

	startedAt := time.Now()
	response, err := f.client.Do(request)
	if err != nil {
		return Result{}, fmt.Errorf("fetch source payload: %w", err)
	}
	defer func() {
		_, _ = io.Copy(io.Discard, response.Body)
		_ = response.Body.Close()
	}()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return Result{}, HTTPError{
			Classification: classifyStatus(response.StatusCode),
			Status:         response.Status,
			StatusCode:     response.StatusCode,
		}
	}

	buffer := f.bufferPool.Get().(*bytes.Buffer)
	buffer.Reset()
	defer f.bufferPool.Put(buffer)

	if _, err := buffer.ReadFrom(response.Body); err != nil {
		return Result{}, fmt.Errorf("read source payload: %w", err)
	}

	payload := append([]byte(nil), buffer.Bytes()...)
	result := Result{
		ContentType: firstNonEmpty(strings.TrimSpace(response.Header.Get("Content-Type")), f.defaultContentType),
		FetchedAt:   time.Now().UTC(),
		Payload:     payload,
		StatusCode:  response.StatusCode,
	}

	if f.logger != nil {
		domain := "unknown"
		if parsedURL, parseErr := url.Parse(endpointURL); parseErr == nil && parsedURL.Host != "" {
			domain = parsedURL.Host
		}
		f.logger.InfoContext(ctx, "source fetch completed",
			"domain", domain,
			"status_code", response.StatusCode,
			"bytes_processed", len(payload),
			"latency_ms", time.Since(startedAt).Milliseconds(),
		)
	}

	return result, nil
}

func classifyStatus(statusCode int) Classification {
	switch statusCode {
	case http.StatusTooManyRequests, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return ClassificationRetryable
	case http.StatusForbidden, http.StatusNotFound:
		return ClassificationFatal
	default:
		return ClassificationFatal
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}

	return ""
}
