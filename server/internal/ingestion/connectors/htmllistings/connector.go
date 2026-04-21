package htmllistings

import (
	"context"
	"net/http"
	"time"

	"home-searcher/server/internal/fetcher"
	app "home-searcher/server/internal/ingestion/application"
	"home-searcher/server/internal/ingestion/browser"
	"home-searcher/server/internal/ingestion/domain"
	portalparser "home-searcher/server/internal/parser"
	platformconfig "home-searcher/server/internal/platform/config"
)

// Kind identifies the generic HTML listings connector.
const Kind = "html-listings"

// Connector fetches HTML pages and extracts listing data through CSS selectors.
type Connector struct {
	fetcher  *fetcher.HTTPFetcher
	parser   portalparser.HTMLListingsParser
	renderer browser.Renderer
}

// NewConnector builds an HTML listings connector.
func NewConnector(client *http.Client, renderer browser.Renderer) *Connector {
	resolvedClient := client
	if resolvedClient == nil {
		resolvedClient = &http.Client{Timeout: 20 * time.Second}
	}

	if renderer == nil {
		renderer = browser.NewRenderer(platformconfig.BrowserConfig{})
	}

	return &Connector{
		fetcher:  fetcher.NewHTTPFetcher(resolvedClient, nil, "text/html; charset=utf-8"),
		parser:   portalparser.NewHTMLListingsParser(),
		renderer: renderer,
	}
}

// Kind returns the connector kind supported by this parser.
func (c *Connector) Kind() string {
	return Kind
}

// ValidateSource ensures that the source configuration contains valid extraction selectors.
func (c *Connector) ValidateSource(source domain.Source) error {
	_, err := portalparser.ParseHTMLListingsConfig(source.ConfigJSON)
	return err
}

// Fetch retrieves a source page over HTTP or through the optional browser renderer.
func (c *Connector) Fetch(ctx context.Context, source domain.Source) (app.FetchResult, error) {
	if source.BrowserEnabled {
		payload, err := c.renderer.Render(ctx, source.EndpointURL)
		if err != nil {
			return app.FetchResult{}, err
		}

		return app.FetchResult{
			ContentType: "text/html; charset=utf-8",
			FetchedAt:   time.Now().UTC(),
			Payload:     payload,
		}, nil
	}

	result, err := c.fetcher.Fetch(ctx, source.EndpointURL, nil)
	if err != nil {
		return app.FetchResult{}, err
	}

	return app.FetchResult{
		ContentType: result.ContentType,
		FetchedAt:   result.FetchedAt,
		Payload:     result.Payload,
	}, nil
}

// Parse extracts candidate listings from HTML cards using the source config selectors.
func (c *Connector) Parse(_ context.Context, source domain.Source, payload []byte) ([]domain.CandidateListing, error) {
	return c.parser.Parse(source, payload)
}
