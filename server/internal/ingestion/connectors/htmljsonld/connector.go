/**
 * File: internal/ingestion/connectors/htmljsonld/connector.go
 *
 * Purpose:
 * Connects ingestion sources to parser and fetcher abstractions.
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
 * - nido/server/internal/fetcher
 * - nido/server/internal/ingestion/application
 * - nido/server/internal/ingestion/browser
 * - nido/server/internal/ingestion/domain
 * - nido/server/internal/parser/htmljsonld
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package htmljsonld

import (
	"context"

	"nido/server/internal/fetcher"
	app "nido/server/internal/ingestion/application"
	"nido/server/internal/ingestion/browser"
	"nido/server/internal/ingestion/domain"
	parser "nido/server/internal/parser/htmljsonld"
)

// Kind identifies the HTML JSON-LD connector used for real portal pages.
const Kind = "html-jsonld"

/**
 * Purpose:
 * Defines the Connector struct used by this package and its consumers.
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
type Connector struct {
	fetcher fetcher.Client
}

/**
 * Purpose:
 * Performs the NewConnector operation for this backend package.
 *
 * Parameters:
 * - client fetcher.Client, renderer browser.Renderer
 *
 * Returns:
 * - *Connector
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func NewConnector(client fetcher.Client, renderer browser.Renderer) *Connector {
	resolvedClient := client
	if resolvedClient == nil {
		resolvedClient = fetcher.New(fetcher.Config{}, renderer)
	}

	return &Connector{fetcher: resolvedClient}
}

/**
 * Purpose:
 * Performs the Kind operation for this backend package.
 *
 * Parameters:
 * - c *Connector
 *
 * Returns:
 * - Kind() string
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func (c *Connector) Kind() string {
	return Kind
}

/**
 * Purpose:
 * Performs the Fetch operation for this backend package.
 *
 * Parameters:
 * - c *Connector
 *
 * Returns:
 * - Fetch(ctx context.Context, source domain.Source) (app.FetchResult, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func (c *Connector) Fetch(ctx context.Context, source domain.Source) (app.FetchResult, error) {
	response, err := c.fetcher.Fetch(ctx, fetcher.Request{
		URL:                        source.EndpointURL,
		Accept:                     "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		DefaultContentType:         "text/html; charset=utf-8",
		BrowserEnabled:             source.BrowserEnabled,
		BrowserFallbackOnChallenge: true,
		SessionKey:                 source.ID,
	})
	if err != nil {
		return app.FetchResult{}, err
	}

	return app.FetchResult{
		Payload:     response.Payload,
		ContentType: response.ContentType,
		FetchedAt:   response.FetchedAt,
		Domain:      response.Domain,
		Proxy:       response.ProxyProvider,
		Latency:     response.Latency,
		ByteCount:   response.BytesProcessed,
	}, nil
}

/**
 * Purpose:
 * Performs the Parse operation for this backend package.
 *
 * Parameters:
 * - c *Connector
 *
 * Returns:
 * - Parse(_ context.Context, source domain.Source, payload []byte) ([]domain.CandidateListing, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func (c *Connector) Parse(_ context.Context, source domain.Source, payload []byte) ([]domain.CandidateListing, error) {
	return parser.Parse(source, payload)
}
