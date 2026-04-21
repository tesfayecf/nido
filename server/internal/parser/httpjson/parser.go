package httpjson

import (
	"encoding/json"
	"fmt"
	"strings"

	"home-searcher/server/internal/ingestion/domain"
)

// Parse normalizes the bootstrap JSON feed into candidate listings.
func Parse(payload []byte) ([]domain.CandidateListing, error) {
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
