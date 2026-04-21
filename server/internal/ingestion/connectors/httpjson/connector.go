package httpjson

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"home-searcher/server/internal/fetcher"
	app "home-searcher/server/internal/ingestion/application"
	"home-searcher/server/internal/ingestion/domain"
)

// Kind identifies the bootstrap connector used in the first iteration.
const Kind = "http-json-feed"

// Connector fetches and parses the bootstrap JSON feed contract.
type Connector struct {
	fetcher *fetcher.HTTPFetcher
}

// NewConnector builds a bootstrap HTTP JSON feed connector.
func NewConnector(client *http.Client) *Connector {
	resolvedClient := client
	if resolvedClient == nil {
		resolvedClient = &http.Client{Timeout: 15 * time.Second}
	}

	return &Connector{fetcher: fetcher.NewHTTPFetcher(resolvedClient, nil, "application/json")}
}

// Kind returns the source kind supported by the connector.
func (c *Connector) Kind() string {
	return Kind
}

// Fetch retrieves the source payload over HTTP.
func (c *Connector) Fetch(ctx context.Context, source domain.Source) (app.FetchResult, error) {
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

// Parse normalizes the bootstrap JSON feed into candidate listings.
func (c *Connector) Parse(_ context.Context, _ domain.Source, payload []byte) ([]domain.CandidateListing, error) {
	var feed feedPayload
	if err := json.Unmarshal(payload, &feed); err != nil {
		return nil, fmt.Errorf("parse bootstrap feed: %w", err)
	}

	items := make([]domain.CandidateListing, 0, len(feed.Items))
	for index, item := range feed.Items {
		externalID := strings.TrimSpace(item.ExternalID)
		title := strings.TrimSpace(item.Title)
		currency := strings.TrimSpace(item.Currency)
		location := strings.TrimSpace(item.Location)
		listingURL := strings.TrimSpace(item.URL)

		if externalID == "" {
			return nil, fmt.Errorf("item %d is missing external_id", index)
		}
		if title == "" {
			return nil, fmt.Errorf("item %d is missing title", index)
		}
		if listingURL == "" {
			return nil, fmt.Errorf("item %d is missing url", index)
		}
		if item.PriceAmount < 0 {
			return nil, fmt.Errorf("item %d has a negative price_amount", index)
		}
		if currency == "" {
			currency = "EUR"
		}

		items = append(items, domain.CandidateListing{
			Currency:    currency,
			ExternalID:  externalID,
			Location:    location,
			PriceAmount: item.PriceAmount,
			Title:       title,
			URL:         listingURL,
		})
	}

	return items, nil
}

type feedPayload struct {
	Items []feedItem `json:"items"`
}

type feedItem struct {
	Currency    string `json:"currency"`
	ExternalID  string `json:"external_id"`
	Location    string `json:"location"`
	PriceAmount int64  `json:"price_amount"`
	Title       string `json:"title"`
	URL         string `json:"url"`
}
