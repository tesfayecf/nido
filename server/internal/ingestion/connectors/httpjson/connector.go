package httpjson

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	app "home-searcher/server/internal/ingestion/application"
	"home-searcher/server/internal/ingestion/domain"
)

// Kind identifies the bootstrap connector used in the first iteration.
const Kind = "http-json-feed"

// Connector fetches and parses the bootstrap JSON feed contract.
type Connector struct {
	client *http.Client
}

// NewConnector builds a bootstrap HTTP JSON feed connector.
func NewConnector(client *http.Client) *Connector {
	resolvedClient := client
	if resolvedClient == nil {
		resolvedClient = &http.Client{Timeout: 15 * time.Second}
	}

	return &Connector{client: resolvedClient}
}

// Kind returns the source kind supported by the connector.
func (c *Connector) Kind() string {
	return Kind
}

// Fetch retrieves the source payload over HTTP.
func (c *Connector) Fetch(ctx context.Context, source domain.Source) (app.FetchResult, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, source.EndpointURL, nil)
	if err != nil {
		return app.FetchResult{}, fmt.Errorf("build request: %w", err)
	}

	response, err := c.client.Do(request)
	if err != nil {
		return app.FetchResult{}, fmt.Errorf("fetch source payload: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return app.FetchResult{}, fmt.Errorf("unexpected source status: %s", response.Status)
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return app.FetchResult{}, fmt.Errorf("read source payload: %w", err)
	}

	contentType := response.Header.Get("Content-Type")
	if strings.TrimSpace(contentType) == "" {
		contentType = "application/json"
	}

	return app.FetchResult{
		Payload:     body,
		ContentType: contentType,
		FetchedAt:   time.Now().UTC(),
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
			ExternalID:  externalID,
			Title:       title,
			PriceAmount: item.PriceAmount,
			Currency:    currency,
			Location:    location,
			URL:         listingURL,
		})
	}

	return items, nil
}

type feedPayload struct {
	Items []feedItem `json:"items"`
}

type feedItem struct {
	ExternalID  string `json:"external_id"`
	Title       string `json:"title"`
	PriceAmount int64  `json:"price_amount"`
	Currency    string `json:"currency"`
	Location    string `json:"location"`
	URL         string `json:"url"`
}
