package parser

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/andybalholm/cascadia"

	"home-searcher/server/internal/ingestion/domain"
	"home-searcher/server/internal/platform/id"
)

var digitsPattern = regexp.MustCompile(`\d+`)

// HTMLListingsConfig describes how to extract listing cards from HTML pages.
type HTMLListingsConfig struct {
	BaseURL             string `json:"base_url,omitempty"`
	Currency            string `json:"currency,omitempty"`
	ExternalIDAttribute string `json:"external_id_attribute,omitempty"`
	ItemSelector        string `json:"item_selector"`
	LocationSelector    string `json:"location_selector,omitempty"`
	PriceSelector       string `json:"price_selector"`
	TitleSelector       string `json:"title_selector"`
	URLSelector         string `json:"url_selector"`
}

// HTMLListingsParser extracts candidate listings from HTML cards.
type HTMLListingsParser struct{}

// NewHTMLListingsParser builds a pure HTML listings parser.
func NewHTMLListingsParser() HTMLListingsParser {
	return HTMLListingsParser{}
}

// Parse extracts candidate listings from HTML cards using CSS selectors.
func (HTMLListingsParser) Parse(source domain.Source, payload []byte) ([]domain.CandidateListing, error) {
	config, err := ParseHTMLListingsConfig(source.ConfigJSON)
	if err != nil {
		return nil, err
	}

	document, err := goquery.NewDocumentFromReader(bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("parse html payload: %w", err)
	}

	items := make([]domain.CandidateListing, 0)
	seen := make(map[string]struct{})
	document.Find(config.ItemSelector).Each(func(_ int, item *goquery.Selection) {
		candidate, ok := candidateFromSelection(item, source, config)
		if !ok {
			return
		}

		fingerprint := candidate.ExternalID + "|" + candidate.URL
		if _, exists := seen[fingerprint]; exists {
			return
		}

		seen[fingerprint] = struct{}{}
		items = append(items, candidate)
	})

	if len(items) == 0 {
		return nil, fmt.Errorf("source %q did not expose parsable html listing cards", source.ID)
	}

	return items, nil
}

// ParseHTMLListingsConfig validates and normalizes raw HTML listing config JSON.
func ParseHTMLListingsConfig(raw string) (HTMLListingsConfig, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		trimmed = "{}"
	}

	var config HTMLListingsConfig
	if err := json.Unmarshal([]byte(trimmed), &config); err != nil {
		return HTMLListingsConfig{}, fmt.Errorf("parse html listings config: %w", err)
	}

	config.ItemSelector = strings.TrimSpace(config.ItemSelector)
	config.TitleSelector = strings.TrimSpace(config.TitleSelector)
	config.URLSelector = strings.TrimSpace(config.URLSelector)
	config.PriceSelector = strings.TrimSpace(config.PriceSelector)
	config.LocationSelector = strings.TrimSpace(config.LocationSelector)
	config.ExternalIDAttribute = strings.TrimSpace(config.ExternalIDAttribute)
	config.BaseURL = strings.TrimSpace(config.BaseURL)
	config.Currency = strings.TrimSpace(config.Currency)
	if config.Currency == "" {
		config.Currency = "EUR"
	}

	if err := validateSelector("item_selector", config.ItemSelector, true); err != nil {
		return HTMLListingsConfig{}, err
	}
	if err := validateSelector("title_selector", config.TitleSelector, true); err != nil {
		return HTMLListingsConfig{}, err
	}
	if err := validateSelector("url_selector", config.URLSelector, true); err != nil {
		return HTMLListingsConfig{}, err
	}
	if err := validateSelector("price_selector", config.PriceSelector, true); err != nil {
		return HTMLListingsConfig{}, err
	}
	if err := validateSelector("location_selector", config.LocationSelector, false); err != nil {
		return HTMLListingsConfig{}, err
	}
	if config.BaseURL != "" {
		if _, err := url.ParseRequestURI(config.BaseURL); err != nil {
			return HTMLListingsConfig{}, fmt.Errorf("invalid html listings base_url: %w", err)
		}
	}

	return config, nil
}

func validateSelector(name, selector string, required bool) error {
	trimmed := strings.TrimSpace(selector)
	if trimmed == "" {
		if required {
			return fmt.Errorf("html listings %s is required", name)
		}

		return nil
	}
	if _, err := cascadia.Compile(trimmed); err != nil {
		return fmt.Errorf("invalid html listings %s: %w", name, err)
	}

	return nil
}

func candidateFromSelection(item *goquery.Selection, source domain.Source, config HTMLListingsConfig) (domain.CandidateListing, bool) {
	title := selectionText(item.Find(config.TitleSelector).First())
	urlValue := selectionAttr(item.Find(config.URLSelector).First(), "href")
	priceAmount, ok := parsePriceAmount(selectionText(item.Find(config.PriceSelector).First()))
	if !ok || title == "" || urlValue == "" {
		return domain.CandidateListing{}, false
	}

	resolvedURL, ok := resolveURL(urlValue, config.BaseURL, source.EndpointURL)
	if !ok {
		return domain.CandidateListing{}, false
	}

	externalID := ""
	if config.ExternalIDAttribute != "" {
		externalID = selectionAttr(item, config.ExternalIDAttribute)
	}
	if externalID == "" {
		externalID = id.Deterministic("ext", source.ID+":"+resolvedURL)
	}

	location := ""
	if config.LocationSelector != "" {
		location = selectionText(item.Find(config.LocationSelector).First())
	}

	return domain.CandidateListing{
		Currency:    config.Currency,
		ExternalID:  externalID,
		Location:    location,
		PriceAmount: priceAmount,
		Title:       title,
		URL:         resolvedURL,
	}, true
}

func selectionText(selection *goquery.Selection) string {
	if selection == nil || selection.Length() == 0 {
		return ""
	}

	return strings.Join(strings.Fields(selection.Text()), " ")
}

func selectionAttr(selection *goquery.Selection, attribute string) string {
	if selection == nil || selection.Length() == 0 {
		return ""
	}

	value, ok := selection.Attr(attribute)
	if !ok {
		return ""
	}

	return strings.TrimSpace(value)
}

func parsePriceAmount(value string) (int64, bool) {
	matches := digitsPattern.FindAllString(value, -1)
	if len(matches) == 0 {
		return 0, false
	}

	number, err := strconv.ParseInt(strings.Join(matches, ""), 10, 64)
	if err != nil {
		return 0, false
	}

	return number, true
}

func resolveURL(rawURL, baseURL, endpointURL string) (string, bool) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return "", false
	}
	if parsed.IsAbs() {
		return parsed.String(), true
	}

	for _, candidateBase := range []string{baseURL, endpointURL} {
		if strings.TrimSpace(candidateBase) == "" {
			continue
		}
		parsedBase, err := url.Parse(candidateBase)
		if err != nil {
			continue
		}
		return parsedBase.ResolveReference(parsed).String(), true
	}

	return "", false
}
