package htmllistings

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/andybalholm/cascadia"

	app "home-searcher/server/internal/ingestion/application"
	"home-searcher/server/internal/ingestion/browser"
	"home-searcher/server/internal/ingestion/domain"
	platformconfig "home-searcher/server/internal/platform/config"
	"home-searcher/server/internal/platform/id"
)

// Kind identifies the generic HTML listings connector.
const Kind = "html-listings"

var digitsPattern = regexp.MustCompile(`\d+`)

// Config describes how to extract listing cards from an HTML page.
type Config struct {
	ItemSelector        string `json:"item_selector"`
	TitleSelector       string `json:"title_selector"`
	URLSelector         string `json:"url_selector"`
	PriceSelector       string `json:"price_selector"`
	LocationSelector    string `json:"location_selector,omitempty"`
	ExternalIDAttribute string `json:"external_id_attribute,omitempty"`
	BaseURL             string `json:"base_url,omitempty"`
	Currency            string `json:"currency,omitempty"`
}

// Connector fetches HTML pages and extracts listing data through CSS selectors.
type Connector struct {
	client   *http.Client
	renderer browser.Renderer
}

// NewConnector builds an HTML listings connector.
func NewConnector(client *http.Client, renderer browser.Renderer) *Connector {
	resolvedClient := client
	if resolvedClient == nil {
		resolvedClient = &http.Client{Timeout: 20 * time.Second}
	}

	if renderer == nil {
		renderer = browser.NewRenderer(platformconfig.BrowserConfig{})
	}

	return &Connector{client: resolvedClient, renderer: renderer}
}

// Kind returns the connector kind supported by this parser.
func (c *Connector) Kind() string {
	return Kind
}

// ValidateSource ensures that the source configuration contains valid extraction selectors.
func (c *Connector) ValidateSource(source domain.Source) error {
	_, err := parseConfig(source.ConfigJSON)
	return err
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

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, source.EndpointURL, nil)
	if err != nil {
		return app.FetchResult{}, fmt.Errorf("build request: %w", err)
	}

	response, err := c.client.Do(request)
	if err != nil {
		return app.FetchResult{}, fmt.Errorf("fetch source payload: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return app.FetchResult{}, fmt.Errorf("unexpected source status: %s", response.Status)
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return app.FetchResult{}, fmt.Errorf("read source payload: %w", err)
	}

	contentType := response.Header.Get("Content-Type")
	if strings.TrimSpace(contentType) == "" {
		contentType = "text/html; charset=utf-8"
	}

	return app.FetchResult{
		Payload:     body,
		ContentType: contentType,
		FetchedAt:   time.Now().UTC(),
	}, nil
}

// Parse extracts candidate listings from HTML cards using the source config selectors.
func (c *Connector) Parse(_ context.Context, source domain.Source, payload []byte) ([]domain.CandidateListing, error) {
	config, err := parseConfig(source.ConfigJSON)
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

func parseConfig(raw string) (Config, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		trimmed = "{}"
	}

	var config Config
	if err := json.Unmarshal([]byte(trimmed), &config); err != nil {
		return Config{}, fmt.Errorf("parse html listings config: %w", err)
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
		return Config{}, err
	}
	if err := validateSelector("title_selector", config.TitleSelector, true); err != nil {
		return Config{}, err
	}
	if err := validateSelector("url_selector", config.URLSelector, true); err != nil {
		return Config{}, err
	}
	if err := validateSelector("price_selector", config.PriceSelector, true); err != nil {
		return Config{}, err
	}
	if err := validateSelector("location_selector", config.LocationSelector, false); err != nil {
		return Config{}, err
	}
	if config.BaseURL != "" {
		if _, err := url.ParseRequestURI(config.BaseURL); err != nil {
			return Config{}, fmt.Errorf("invalid html listings base_url: %w", err)
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

func candidateFromSelection(item *goquery.Selection, source domain.Source, config Config) (domain.CandidateListing, bool) {
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
		ExternalID:  externalID,
		Title:       title,
		PriceAmount: priceAmount,
		Currency:    config.Currency,
		Location:    location,
		URL:         resolvedURL,
	}, true
}

func selectionText(selection *goquery.Selection) string {
	if selection == nil || selection.Length() == 0 {
		return ""
	}

	return strings.Join(strings.Fields(selection.Text()), " ")
}

func selectionAttr(selection *goquery.Selection, name string) string {
	if selection == nil || selection.Length() == 0 {
		return ""
	}

	value, ok := selection.Attr(name)
	if !ok {
		return ""
	}

	return strings.TrimSpace(value)
}

func parsePriceAmount(raw string) (int64, bool) {
	digits := strings.Join(digitsPattern.FindAllString(raw, -1), "")
	if digits == "" {
		return 0, false
	}

	amount, err := strconv.ParseInt(digits, 10, 64)
	if err != nil {
		return 0, false
	}

	return amount, true
}

func resolveURL(raw, baseURL, fallbackURL string) (string, bool) {
	reference, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", false
	}
	if reference.IsAbs() {
		return reference.String(), true
	}

	resolvedBase := strings.TrimSpace(baseURL)
	if resolvedBase == "" {
		resolvedBase = strings.TrimSpace(fallbackURL)
	}
	if resolvedBase == "" {
		return reference.String(), true
	}

	base, err := url.Parse(resolvedBase)
	if err != nil {
		return "", false
	}

	return base.ResolveReference(reference).String(), true
}
