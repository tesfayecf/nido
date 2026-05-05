/**
 * File: internal/parser/httpjson/parser.go
 *
 * Purpose:
 * Parses external property-listing payloads into normalized ingestion data.
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
 * - encoding/json
 * - fmt
 * - strings
 * - nido/server/internal/ingestion/domain
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package httpjson

import (
	"encoding/json"
	"fmt"
	"strings"

	"nido/server/internal/ingestion/domain"
)

/**
 * Purpose:
 * Performs the Parse operation for this backend package.
 *
 * Parameters:
 * - payload []byte
 *
 * Returns:
 * - ([]domain.CandidateListing, error)
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

/**
 * Purpose:
 * Defines the feedPayload struct used by this package and its consumers.
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
type feedPayload struct {
	Items []feedItem `json:"items"`
}

/**
 * Purpose:
 * Defines the feedItem struct used by this package and its consumers.
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
type feedItem struct {
	ExternalID  string `json:"external_id"`
	Title       string `json:"title"`
	PriceAmount int64  `json:"price_amount"`
	Currency    string `json:"currency"`
	Location    string `json:"location"`
	URL         string `json:"url"`
}
