package htmljsonld

import (
	"testing"

	"home-searcher/server/internal/ingestion/domain"
)

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
