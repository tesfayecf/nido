/**
 * File: internal/fetcher/types.go
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
 * - context
 * - log/slog
 * - net/http
 * - time
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
	"log/slog"
	"net/http"
	"time"
)

/**
 * Purpose:
 * Defines the Client interface used by this package and its consumers.
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
type Client interface {
	Fetch(ctx context.Context, request Request) (Response, error)
}

/**
 * Purpose:
 * Defines the Config struct used by this package and its consumers.
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
type Config struct {
	Logger          *slog.Logger
	HTTPClient      *http.Client
	Timeout         time.Duration
	ProxyProvider   string
	TLSProfile      string
	MinRequestGap   time.Duration
	BreakerInterval time.Duration
	BreakerTimeout  time.Duration
	Profiles        []SessionProfile
}

/**
 * Purpose:
 * Defines the Request struct used by this package and its consumers.
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
type Request struct {
	URL                        string
	Accept                     string
	DefaultContentType         string
	BrowserEnabled             bool
	BrowserFallbackOnChallenge bool
	Headers                    map[string]string
	SessionKey                 string
}

/**
 * Purpose:
 * Defines the Response struct used by this package and its consumers.
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
type Response struct {
	Payload        []byte
	ContentType    string
	FetchedAt      time.Time
	BytesProcessed int
	Domain         string
	ProxyProvider  string
	Latency        time.Duration
}
