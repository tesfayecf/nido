/**
 * File: internal/parser/httpjson/parser_test.go
 *
 * Purpose:
 * Validates the httpjson package behavior covered by parser_test.go.
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
 * - strings
 * - testing
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package httpjson

import (
	"strings"
	"testing"
)

/**
 * Purpose:
 * Performs the TestParseFeed operation for this backend package.
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
func TestParseFeed(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		payload string
		wantErr string
	}{
		{
			name:    "realistic feed item",
			payload: `{"items":[{"external_id":"listing-123","title":"Bright flat in Girona","price_amount":245000,"currency":"EUR","location":"Girona","url":"https://example.test/listings/123"}]}`,
		},
		{
			name:    "missing external id",
			payload: `{"items":[{"title":"Broken listing","price_amount":245000,"url":"https://example.test/listings/123"}]}`,
			wantErr: "external_id",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := Parse([]byte(test.payload))
			if test.wantErr == "" && err != nil {
				t.Fatalf("parse feed: %v", err)
			}
			if test.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), test.wantErr) {
					t.Fatalf("expected error containing %q, got %v", test.wantErr, err)
				}
			}
		})
	}
}
