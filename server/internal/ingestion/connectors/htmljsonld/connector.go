package htmljsonld

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"home-searcher/server/internal/fetcher"
	app "home-searcher/server/internal/ingestion/application"
	"home-searcher/server/internal/ingestion/browser"
	"home-searcher/server/internal/ingestion/domain"
	platformconfig "home-searcher/server/internal/platform/config"
	"home-searcher/server/internal/platform/id"
)

// Kind identifies the HTML JSON-LD connector used for real portal pages.
const Kind = "html-jsonld"

var jsonLDScriptPattern = regexp.MustCompile(`(?is)<script[^>]*type\s*=\s*["']application/ld\+json["'][^>]*>(.*?)</script>`)

// Connector fetches HTML pages and extracts listing data from JSON-LD blocks.
type Connector struct {
	fetcher  *fetcher.HTTPFetcher
	renderer browser.Renderer
}

// NewConnector builds an HTML JSON-LD connector.
func NewConnector(client *http.Client, renderer browser.Renderer) *Connector {
	resolvedClient := client
	if resolvedClient == nil {
		resolvedClient = &http.Client{Timeout: 20 * time.Second}
	}

	if renderer == nil {
		renderer = browser.NewRenderer(platformconfig.BrowserConfig{})
	}

	return &Connector{fetcher: fetcher.NewHTTPFetcher(resolvedClient, nil, "text/html; charset=utf-8"), renderer: renderer}
}

// Kind returns the connector kind supported by this parser.
func (c *Connector) Kind() string {
	return Kind
}

// Fetch retrieves a source page over HTTP or through the optional browser renderer.
func (c *Connector) Fetch(ctx context.Context, source domain.Source) (app.FetchResult, error) {
	if source.BrowserEnabled {
		payload, err := c.renderer.Render(ctx, source.EndpointURL)
		if err != nil {
			return app.FetchResult{}, err
		}

		return app.FetchResult{
			Payload:     payload,
			ContentType: "text/html; charset=utf-8",
			FetchedAt:   time.Now().UTC(),
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

// Parse extracts candidate listings from JSON-LD blocks embedded in the page.
func (c *Connector) Parse(_ context.Context, source domain.Source, payload []byte) ([]domain.CandidateListing, error) {
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

func firstNonNil(values ...any) any {
	for _, value := range values {
		if value != nil {
			return value
		}
	}

	return nil
}

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
