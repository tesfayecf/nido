package httpjson

import (
	"strings"
	"testing"
)

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
