/**
 * File: internal/parser/htmljsonld/parser_test.go
 *
 * Purpose:
 * Validates the htmljsonld package behavior covered by parser_test.go.
 *
 * Responsibilities:
 * - Set up deterministic test fixtures
 * - Exercise expected success and failure paths
 * - Protect backend behavior from regressions
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - testing
 * - nido/server/internal/ingestion/domain
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package htmljsonld

import (
	"testing"

	"nido/server/internal/ingestion/domain"
)

/**
 * Purpose:
 * Performs the TestParseJSONLDListings operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
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
func TestParseJSONLDListings(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		payload   string
		wantTitle string
		wantURL   string
		wantPrice int64
		wantLoc   string
	}{
		{
			name: "schema item list",
			payload: `<html><body><script type="application/ld+json">{
"@context":"https://schema.org",
"itemListElement":[{
"@type":"ListItem",
"item":{
"@type":"Apartment",
"name":"Pis al Barri Vell",
"url":"https://example.test/listings/ld-1",
"offers":{"price":"325000","priceCurrency":"EUR"},
"address":{"addressLocality":"Girona"}
}
}]
}</script></body></html>`,
			wantTitle: "Pis al Barri Vell",
			wantURL:   "https://example.test/listings/ld-1",
			wantPrice: 325000,
			wantLoc:   "Girona",
		},
		{
			name:    "missing jsonld blocks",
			payload: `<html><body><p>no schema here</p></body></html>`,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			items, err := Parse(domain.Source{ID: "jsonld-source"}, []byte(test.payload))
			if test.wantTitle == "" {
				if err == nil {
					t.Fatal("expected parse error")
				}
				return
			}
			if err != nil {
				t.Fatalf("parse json-ld: %v", err)
			}
			if len(items) != 1 {
				t.Fatalf("expected one listing, got %d", len(items))
			}
			item := items[0]
			if item.Title != test.wantTitle || item.URL != test.wantURL || item.PriceAmount != test.wantPrice || item.Location != test.wantLoc {
				t.Fatalf("unexpected item: %#v", item)
			}
		})
	}
}
