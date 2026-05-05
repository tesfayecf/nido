/**
 * File: internal/parser/htmljsonld/parser.go
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
 * - html
 * - regexp
 * - strconv
 * - strings
 * - nido/server/internal/ingestion/domain
 * - nido/server/internal/platform/id
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package htmljsonld

import (
	"encoding/json"
	"fmt"
	"html"
	"regexp"
	"strconv"
	"strings"

	"nido/server/internal/ingestion/domain"
	"nido/server/internal/platform/id"
)

var jsonLDScriptPattern = regexp.MustCompile(`(?is)<script[^>]*type\s*=\s*["']application/ld\+json["'][^>]*>(.*?)</script>`)

/**
 * Purpose:
 * Performs the Parse operation for this backend package.
 *
 * Parameters:
 * - source domain.Source, payload []byte
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
func Parse(source domain.Source, payload []byte) ([]domain.CandidateListing, error) {
	matches := jsonLDScriptPattern.FindAllSubmatch(payload, -1)
	if len(matches) == 0 {
		return nil, fmt.Errorf("source %q did not contain application/ld+json blocks", source.ID)
	}

	items := make([]domain.CandidateListing, 0)
	seen := make(map[string]struct{})
	for _, match := range matches {
		block := strings.TrimSpace(html.UnescapeString(string(match[1])))
		if block == "" {
			continue
		}

		var node any
		if err := json.Unmarshal([]byte(block), &node); err != nil {
			continue
		}

		collectCandidates(node, source.ID, seen, &items)
	}

	if len(items) == 0 {
		return nil, fmt.Errorf("source %q did not expose parsable listing data in json-ld", source.ID)
	}

	return items, nil
}

/**
 * Purpose:
 * Performs the collectCandidates operation for this backend package.
 *
 * Parameters:
 * - node any, sourceID string, seen map[string]struct{}, items *[]domain.CandidateListing
 *
 * Returns:
 * - None.
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
func collectCandidates(node any, sourceID string, seen map[string]struct{}, items *[]domain.CandidateListing) {
	switch typed := node.(type) {
	case []any:
		for _, child := range typed {
			collectCandidates(child, sourceID, seen, items)
		}
	case map[string]any:
		if itemList, ok := typed["itemListElement"]; ok {
			collectCandidates(itemList, sourceID, seen, items)
		}
		if item, ok := typed["item"]; ok {
			collectCandidates(item, sourceID, seen, items)
		}
		if graph, ok := typed["@graph"]; ok {
			collectCandidates(graph, sourceID, seen, items)
		}

		candidate, ok := candidateFromNode(typed, sourceID)
		if !ok {
			return
		}

		fingerprint := candidate.ExternalID + "|" + candidate.URL
		if _, exists := seen[fingerprint]; exists {
			return
		}
		seen[fingerprint] = struct{}{}
		*items = append(*items, candidate)
	}
}

/**
 * Purpose:
 * Performs the candidateFromNode operation for this backend package.
 *
 * Parameters:
 * - node map[string]any, sourceID string
 *
 * Returns:
 * - (domain.CandidateListing, bool)
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
func candidateFromNode(node map[string]any, sourceID string) (domain.CandidateListing, bool) {
	title := strings.TrimSpace(stringValue(node["name"]))
	listingURL := strings.TrimSpace(stringValue(firstNonNil(node["url"], node["@id"])))
	priceAmount, ok := priceValue(firstNonNil(nested(node, "offers", "price"), node["price"]))
	if !ok || title == "" || listingURL == "" {
		return domain.CandidateListing{}, false
	}

	externalID := strings.TrimSpace(stringValue(firstNonNil(node["identifier"], node["sku"], node["@id"])))
	if externalID == "" {
		externalID = id.Deterministic("ext", sourceID+":"+listingURL)
	}

	currency := strings.TrimSpace(stringValue(firstNonNil(nested(node, "offers", "priceCurrency"), node["priceCurrency"])))
	if currency == "" {
		currency = "EUR"
	}

	location := strings.TrimSpace(stringValue(firstNonNil(
		nested(node, "address", "addressLocality"),
		nested(node, "address", "streetAddress"),
		node["location"],
	)))

	return domain.CandidateListing{
		ExternalID:  externalID,
		Title:       title,
		PriceAmount: priceAmount,
		Currency:    currency,
		Location:    location,
		URL:         listingURL,
	}, true
}

/**
 * Purpose:
 * Performs the nested operation for this backend package.
 *
 * Parameters:
 * - node map[string]any, keys ...string
 *
 * Returns:
 * - any
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
func nested(node map[string]any, keys ...string) any {
	current := any(node)
	for _, key := range keys {
		mapValue, ok := current.(map[string]any)
		if !ok {
			return nil
		}
		current = mapValue[key]
	}

	return current
}

/**
 * Purpose:
 * Performs the firstNonNil operation for this backend package.
 *
 * Parameters:
 * - values ...any
 *
 * Returns:
 * - any
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
func firstNonNil(values ...any) any {
	for _, value := range values {
		if value != nil {
			return value
		}
	}

	return nil
}

/**
 * Purpose:
 * Performs the stringValue operation for this backend package.
 *
 * Parameters:
 * - value any
 *
 * Returns:
 * - string
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
func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case map[string]any:
		if raw, ok := typed["@value"]; ok {
			return stringValue(raw)
		}
	case []any:
		if len(typed) > 0 {
			return stringValue(typed[0])
		}
	}

	return ""
}

/**
 * Purpose:
 * Performs the priceValue operation for this backend package.
 *
 * Parameters:
 * - value any
 *
 * Returns:
 * - (int64, bool)
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
func priceValue(value any) (int64, bool) {
	switch typed := value.(type) {
	case float64:
		return int64(typed), true
	case string:
		trimmed := strings.TrimSpace(strings.ReplaceAll(typed, ",", ""))
		if trimmed == "" {
			return 0, false
		}

		parsedFloat, err := strconv.ParseFloat(trimmed, 64)
		if err == nil {
			return int64(parsedFloat), true
		}
	case json.Number:
		parsedInt, err := typed.Int64()
		if err == nil {
			return parsedInt, true
		}
	}

	return 0, false
}
