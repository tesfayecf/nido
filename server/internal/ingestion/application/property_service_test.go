package application

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"home-searcher/server/internal/engine"
	"home-searcher/server/internal/fetcher"
	ingestiondomain "home-searcher/server/internal/ingestion/domain"
)

type stubFetchClient struct {
	requests []fetcher.Request
	response fetcher.Response
	err      error
}

func (client *stubFetchClient) Fetch(_ context.Context, request fetcher.Request) (fetcher.Response, error) {
	client.requests = append(client.requests, request)
	return client.response, client.err
}

func TestApplySelectorsSupportsStructuredSelectors(t *testing.T) {
	t.Parallel()

	body := []byte(`
		<html>
			<body>
				<h1 class="listing-title">Sunny flat</h1>
				<a class="listing-link" href="/listing/1">Open</a>
				<div class="value-alt">€310,000</div>
			</body>
		</html>
	`)

	values, failures, fields := applySelectors(body, []ingestiondomain.FieldSelector{
		{
			Name:              "price",
			SelectorType:      ingestiondomain.SelectorTypeCSS,
			SelectorValue:     ".value-primary",
			FallbackSelectors: []string{".value-alt"},
			ExtractionMode:    ingestiondomain.ExtractionModeText,
			Required:          true,
			Transform:         "number",
		},
		{
			Name:           "url",
			SelectorType:   ingestiondomain.SelectorTypeAttribute,
			SelectorValue:  ".listing-link",
			ExtractionMode: ingestiondomain.ExtractionModeAttribute,
			Attribute:      "href",
			Required:       true,
		},
	})

	if len(failures) != 0 {
		t.Fatalf("expected no failures, got %v", failures)
	}
	if got := values["price"]; got != "310000" {
		t.Fatalf("expected normalized fallback value, got %q", got)
	}
	if got := values["url"]; got != "/listing/1" {
		t.Fatalf("expected attribute extraction, got %q", got)
	}
	if len(fields) != 2 || !fields[0].UsedFallback || fields[0].MatchedSelector != ".value-alt" {
		t.Fatalf("expected fallback selector to be reported, got %+v", fields)
	}
}

func TestApplySelectorsSupportsXPathSelectors(t *testing.T) {
	t.Parallel()

	body := []byte(`
		<html>
			<body>
				<section>
					<span data-testid="price">€450,000</span>
				</section>
			</body>
		</html>
	`)

	values, failures, fields := applySelectors(body, []ingestiondomain.FieldSelector{
		{
			Name:           "price",
			SelectorType:   ingestiondomain.SelectorTypeXPath,
			SelectorValue:  "//span[@data-testid='price']",
			ExtractionMode: ingestiondomain.ExtractionModeText,
			Required:       true,
		},
	})

	if len(failures) != 0 {
		t.Fatalf("expected no failures, got %v", failures)
	}
	if got := values["price"]; got != "€450,000" {
		t.Fatalf("expected xpath value, got %q", got)
	}
	if len(fields) != 1 || !fields[0].Success || fields[0].MatchedSelector != "//span[@data-testid='price']" {
		t.Fatalf("expected xpath preview metadata, got %+v", fields)
	}
}

func TestNormalizeConfiguredFieldsSupportsLegacySelectorShape(t *testing.T) {
	t.Parallel()

	fields, err := normalizeConfiguredFields([]ingestiondomain.FieldSelector{
		{
			Name:          "price",
			SelectorValue: ".price",
			Required:      true,
		},
	})
	if err != nil {
		t.Fatalf("expected legacy field to normalize, got %v", err)
	}
	if len(fields) != 1 {
		t.Fatalf("expected one field, got %d", len(fields))
	}
	if fields[0].SelectorType != ingestiondomain.SelectorTypeCSS {
		t.Fatalf("expected css selector type, got %q", fields[0].SelectorType)
	}
	if fields[0].ExtractionMode != ingestiondomain.ExtractionModeText {
		t.Fatalf("expected text extraction mode, got %q", fields[0].ExtractionMode)
	}
}

func TestNormalizeConfiguredFieldsRejectsUnsupportedXPathSyntax(t *testing.T) {
	t.Parallel()

	_, err := normalizeConfiguredFields([]ingestiondomain.FieldSelector{
		{
			Name:           "price",
			SelectorType:   ingestiondomain.SelectorTypeXPath,
			SelectorValue:  "//span[contains(@class,'price')]",
			ExtractionMode: ingestiondomain.ExtractionModeText,
		},
	})
	if err == nil {
		t.Fatal("expected xpath validation error")
	}
}

func TestNormalizeConfiguredFieldsAcceptsAbsoluteXPathSelector(t *testing.T) {
	t.Parallel()

	fields, err := normalizeConfiguredFields([]ingestiondomain.FieldSelector{
		{
			Name:           "price",
			SelectorType:   ingestiondomain.SelectorTypeXPath,
			SelectorValue:  "/html/body/main/div[1]/section[3]/div/div/div/span",
			ExtractionMode: ingestiondomain.ExtractionModeText,
		},
	})
	if err != nil {
		t.Fatalf("expected absolute xpath to normalize, got %v", err)
	}
	if len(fields) != 1 || fields[0].SelectorValue != "/html/body/main/div[1]/section[3]/div/div/div/span" {
		t.Fatalf("expected absolute xpath to be preserved, got %+v", fields)
	}
}

func TestPreviewExtractionUsesSharedFetcher(t *testing.T) {
	t.Parallel()

	client := &stubFetchClient{
		response: fetcher.Response{
			Payload:   []byte(`<html><body><section class="summary"><div class="price"><span itemprop="price">198.000 €</span></div></section></body></html>`),
			FetchedAt: time.Now().UTC(),
		},
	}
	service := NewPropertyService(nil, nil, client, nil, nil, nil)

	result, err := service.PreviewExtraction(context.Background(), ingestiondomain.PropertyPreviewRequest{
		URL: "https://www.habitaclia.com/example",
		Fields: []ingestiondomain.FieldSelector{
			{
				Name:           "price",
				SelectorType:   ingestiondomain.SelectorTypeCSS,
				SelectorValue:  `span[itemprop="price"]`,
				ExtractionMode: ingestiondomain.ExtractionModeText,
				Transform:      "number",
				Required:       true,
			},
		},
	})
	if err != nil {
		t.Fatalf("expected preview to succeed, got %v", err)
	}
	if got := result.Values["price"]; got != "198000" {
		t.Fatalf("expected normalized price from shared fetcher response, got %q", got)
	}
	if len(client.requests) != 1 {
		t.Fatalf("expected one fetch request, got %d", len(client.requests))
	}
	if got := client.requests[0].URL; got != "https://www.habitaclia.com/example" {
		t.Fatalf("expected preview URL to be fetched, got %q", got)
	}
	if got := client.requests[0].Accept; got == "" {
		t.Fatal("expected HTML accept header to be set")
	}
}

func TestPreviewExtractionForwardsBrowserAndRequestHeaders(t *testing.T) {
	t.Parallel()

	client := &stubFetchClient{
		response: fetcher.Response{
			Payload:   []byte(`<html><body><span itemprop="price">198.000 €</span></body></html>`),
			FetchedAt: time.Now().UTC(),
		},
	}
	service := NewPropertyService(nil, nil, client, nil, nil, nil)

	_, err := service.PreviewExtraction(context.Background(), ingestiondomain.PropertyPreviewRequest{
		URL:            "https://www.habitaclia.com/example",
		BrowserEnabled: true,
		RequestHeaders: map[string]string{
			"cookie":     "session=abc",
			"user-agent": "Mozilla/5.0",
		},
		Fields: []ingestiondomain.FieldSelector{
			{
				Name:           "price",
				SelectorType:   ingestiondomain.SelectorTypeCSS,
				SelectorValue:  `span[itemprop="price"]`,
				ExtractionMode: ingestiondomain.ExtractionModeText,
				Required:       true,
			},
		},
	})
	if err != nil {
		t.Fatalf("expected preview to succeed, got %v", err)
	}
	if len(client.requests) != 1 {
		t.Fatalf("expected one fetch request, got %d", len(client.requests))
	}
	if !client.requests[0].BrowserEnabled {
		t.Fatal("expected browser-enabled preview request to reach fetcher")
	}
	if got := client.requests[0].Headers["Cookie"]; got != "session=abc" {
		t.Fatalf("expected normalized cookie header, got %q", got)
	}
	if got := client.requests[0].Headers["User-Agent"]; got != "Mozilla/5.0" {
		t.Fatalf("expected normalized user agent header, got %q", got)
	}
}

func TestPreviewExtractionRejectsUnsupportedRequestHeaders(t *testing.T) {
	t.Parallel()

	service := NewPropertyService(nil, nil, &stubFetchClient{}, nil, nil, nil)

	_, err := service.PreviewExtraction(context.Background(), ingestiondomain.PropertyPreviewRequest{
		URL: "https://example.com/listing",
		RequestHeaders: map[string]string{
			"Host": "internal.example",
		},
		Fields: []ingestiondomain.FieldSelector{
			{
				Name:           "price",
				SelectorType:   ingestiondomain.SelectorTypeCSS,
				SelectorValue:  ".price",
				ExtractionMode: ingestiondomain.ExtractionModeText,
				Required:       true,
			},
		},
	})
	if err == nil {
		t.Fatal("expected unsupported request header to be rejected")
	}
	if got := err.Error(); !strings.Contains(got, "not supported") {
		t.Fatalf("expected unsupported header error, got %q", got)
	}
}

func TestPreviewExtractionRejectsAntiBotChallengePages(t *testing.T) {
	t.Parallel()

	client := &stubFetchClient{
		err: engine.Retryable(errors.New(`portal returned an anti-bot challenge page via http (matched "pardon our interruption")`)),
	}
	service := NewPropertyService(nil, nil, client, nil, nil, nil)

	_, err := service.PreviewExtraction(context.Background(), ingestiondomain.PropertyPreviewRequest{
		URL: "https://www.habitaclia.com/example",
		Fields: []ingestiondomain.FieldSelector{
			{
				Name:           "price",
				SelectorType:   ingestiondomain.SelectorTypeCSS,
				SelectorValue:  `span[itemprop="price"]`,
				ExtractionMode: ingestiondomain.ExtractionModeText,
				Required:       true,
			},
		},
	})
	if err == nil {
		t.Fatal("expected preview to fail for anti-bot challenge page")
	}
	if got := err.Error(); !strings.Contains(got, "anti-bot challenge") {
		t.Fatalf("expected anti-bot challenge error, got %q", got)
	}
}
