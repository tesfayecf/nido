package htmllistings

import (
	"context"

	"home-searcher/server/internal/fetcher"
	app "home-searcher/server/internal/ingestion/application"
	"home-searcher/server/internal/ingestion/browser"
	"home-searcher/server/internal/ingestion/domain"
	parser "home-searcher/server/internal/parser/htmllistings"
)

// Kind identifies the generic HTML listings connector.
const Kind = "html-listings"

// Connector fetches HTML pages and extracts listing data through CSS selectors.
type Connector struct {
	fetcher fetcher.Client
}

// NewConnector builds an HTML listings connector.
func NewConnector(client fetcher.Client, renderer browser.Renderer) *Connector {
	resolvedClient := client
	if resolvedClient == nil {
		resolvedClient = fetcher.New(fetcher.Config{}, renderer)
	}

	return &Connector{fetcher: resolvedClient}
}

// Kind returns the connector kind supported by this parser.
func (c *Connector) Kind() string {
	return Kind
}

// ValidateSource ensures that the source configuration contains valid extraction selectors.
func (c *Connector) ValidateSource(source domain.Source) error {
	_, err := parser.ParseConfig(source.ConfigJSON)
	return err
}

// Fetch retrieves a source page over HTTP or through the optional browser renderer.
func (c *Connector) Fetch(ctx context.Context, source domain.Source) (app.FetchResult, error) {
	response, err := c.fetcher.Fetch(ctx, fetcher.Request{
		URL:                source.EndpointURL,
		Accept:             "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		DefaultContentType: "text/html; charset=utf-8",
		BrowserEnabled:     source.BrowserEnabled,
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

// Parse extracts candidate listings from HTML cards using the source config selectors.
func (c *Connector) Parse(_ context.Context, source domain.Source, payload []byte) ([]domain.CandidateListing, error) {
	return parser.Parse(source, payload)
}
