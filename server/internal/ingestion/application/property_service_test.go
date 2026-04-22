package application

import (
	"testing"

	ingestiondomain "home-searcher/server/internal/ingestion/domain"
)

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
