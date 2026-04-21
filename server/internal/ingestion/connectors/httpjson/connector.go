package httpjson

import (
	"context"
	"fmt"

	"home-searcher/server/internal/fetcher"
	app "home-searcher/server/internal/ingestion/application"
	"home-searcher/server/internal/ingestion/domain"
	parser "home-searcher/server/internal/parser/httpjson"
)

// Kind identifies the bootstrap connector used in the first iteration.
const Kind = "http-json-feed"

// Connector fetches and parses the bootstrap JSON feed contract.
type Connector struct {
	fetcher fetcher.Client
}

// NewConnector builds a bootstrap HTTP JSON feed connector.
func NewConnector(client fetcher.Client) *Connector {
	resolvedClient := client
	if resolvedClient == nil {
		resolvedClient = fetcher.New(fetcher.Config{}, nil)
	}

	return &Connector{fetcher: resolvedClient}
}

// Kind returns the source kind supported by the connector.
func (c *Connector) Kind() string {
	return Kind
}

// Fetch retrieves the source payload over HTTP.
func (c *Connector) Fetch(ctx context.Context, source domain.Source) (app.FetchResult, error) {
	response, err := c.fetcher.Fetch(ctx, fetcher.Request{
		URL:                source.EndpointURL,
		Accept:             "application/json, text/plain;q=0.9, */*;q=0.8",
		DefaultContentType: "application/json",
		SessionKey:         source.ID,
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

// Parse normalizes the bootstrap JSON feed into candidate listings.
func (c *Connector) Parse(_ context.Context, _ domain.Source, payload []byte) ([]domain.CandidateListing, error) {
	items, err := parser.Parse(payload)
	if err != nil {
		return nil, fmt.Errorf("parse bootstrap feed: %w", err)
	}

	return items, nil
}
