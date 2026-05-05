/**
 * File: internal/parser/htmllistings/parser.go
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
 * - bytes
 * - encoding/json
 * - fmt
 * - net/url
 * - regexp
 * - strconv
 * - strings
 * - github.com/PuerkitoBio/goquery
 * - github.com/andybalholm/cascadia
 * - nido/server/internal/ingestion/domain
 * - nido/server/internal/platform/id
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package htmllistings

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

	"nido/server/internal/ingestion/domain"
	"nido/server/internal/platform/id"
)

var digitsPattern = regexp.MustCompile(`\d+`)

/**
 * Purpose:
 * Defines the Config struct used by this package and its consumers.
 *
 * Parameters:
 * - None; callers construct or receive this type through package APIs.
 *
 * Returns:
 * - Not applicable; this declaration describes data or behavior shape.
 *
 * Logic Summary:
 * - Centralizes field, method, or contract shape shared across the backend layer.
 *
 * Edge Cases:
 * - Keep field names, JSON tags, and persistence assumptions synchronized with downstream consumers.
 */
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

/**
 * Purpose:
 * Performs the ParseConfig operation for this backend package.
 *
 * Parameters:
 * - raw string
 *
 * Returns:
 * - (Config, error)
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
func ParseConfig(raw string) (Config, error) {
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
	config, err := ParseConfig(source.ConfigJSON)
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

/**
 * Purpose:
 * Performs the validateSelector operation for this backend package.
 *
 * Parameters:
 * - name, selector string, required bool
 *
 * Returns:
 * - error
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

/**
 * Purpose:
 * Performs the candidateFromSelection operation for this backend package.
 *
 * Parameters:
 * - item *goquery.Selection, source domain.Source, config Config
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

/**
 * Purpose:
 * Performs the selectionText operation for this backend package.
 *
 * Parameters:
 * - selection *goquery.Selection
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
func selectionText(selection *goquery.Selection) string {
	if selection == nil || selection.Length() == 0 {
		return ""
	}

	return strings.Join(strings.Fields(selection.Text()), " ")
}

/**
 * Purpose:
 * Performs the selectionAttr operation for this backend package.
 *
 * Parameters:
 * - selection *goquery.Selection, name string
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

/**
 * Purpose:
 * Performs the parsePriceAmount operation for this backend package.
 *
 * Parameters:
 * - raw string
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

/**
 * Purpose:
 * Performs the resolveURL operation for this backend package.
 *
 * Parameters:
 * - raw, baseURL, fallbackURL string
 *
 * Returns:
 * - (string, bool)
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
