package application

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/antchfx/htmlquery"
	"golang.org/x/net/html"

	"home-searcher/server/internal/fetcher"
	ingestiondomain "home-searcher/server/internal/ingestion/domain"
	"home-searcher/server/internal/platform/id"
)

// ErrPropertyNotFound indicates that the requested property does not exist.
var ErrPropertyNotFound = errors.New("property not found")

var xpathSelectorPattern = regexp.MustCompile(`^/{1,2}[-@/\[\]\w\s="'._:*]+$`)

var antiBotChallengeMarkers = []string{
	"pardon our interruption",
	"captcha",
	"access denied",
	"verify you are human",
	"automated access",
}

var supportedPropertyRequestHeaders = map[string]struct{}{
	"Accept":            {},
	"Accept-Language":   {},
	"Cookie":            {},
	"Referer":           {},
	"Sec-Ch-Ua":         {},
	"Sec-Ch-Ua-Mobile":  {},
	"Sec-Ch-Ua-Platform": {},
	"User-Agent":        {},
}

type propertyFetchOptions struct {
	BrowserEnabled bool
	RequestHeaders map[string]string
}

// PropertyStore defines the persistence contract required by PropertyService.
type PropertyStore interface {
	UpsertProperty(ctx context.Context, property ingestiondomain.Property) error
	ListProperties(ctx context.Context) ([]ingestiondomain.Property, error)
	GetProperty(ctx context.Context, propertyID string) (ingestiondomain.Property, error)
	UpdatePropertyRunState(ctx context.Context, propertyID string, status ingestiondomain.PropertyStatus, lastRunAt, nextRunAt *time.Time) error
	UpsertPropertyConfig(ctx context.Context, config ingestiondomain.PropertyExtractionConfig) error
	GetLatestPropertyConfig(ctx context.Context, propertyID string) (ingestiondomain.PropertyExtractionConfig, error)
	CreatePropertySnapshot(ctx context.Context, snapshot ingestiondomain.PropertySnapshot) error
	ListPropertySnapshots(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error)
	ListAllPropertySnapshots(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error)
	GetPropertySnapshot(ctx context.Context, snapshotID string) (ingestiondomain.PropertySnapshot, error)
	GetLastValidPropertySnapshot(ctx context.Context, propertyID string) (ingestiondomain.PropertySnapshot, error)
	GetSource(ctx context.Context, sourceID string) (ingestiondomain.Source, error)
}

// PropertyRunProcessor reacts to completed property runs.
type PropertyRunProcessor interface {
	ProcessPropertyRun(ctx context.Context, propertyID string, current, previous ingestiondomain.PropertySnapshot) (int, error)
}

// PropertyService orchestrates property registration, extraction configuration, and snapshot ingestion.
type PropertyService struct {
	logger  *slog.Logger
	store   PropertyStore
	fetcher fetcher.Client
	clock   Clock
	changes PropertyRunProcessor
	events  Publisher
}

// NewPropertyService builds a PropertyService.
func NewPropertyService(
	logger *slog.Logger,
	store PropertyStore,
	client fetcher.Client,
	clock Clock,
	changes PropertyRunProcessor,
	events Publisher,
) *PropertyService {
	resolvedClock := clock
	if resolvedClock == nil {
		resolvedClock = systemClock{}
	}
	resolvedFetcher := client
	if resolvedFetcher == nil {
		resolvedFetcher = fetcher.New(fetcher.Config{}, nil)
	}

	return &PropertyService{
		logger:  logger,
		store:   store,
		fetcher: resolvedFetcher,
		clock:   resolvedClock,
		changes: changes,
		events:  events,
	}
}

// EnsureProperty validates and upserts a property definition.
func (s *PropertyService) EnsureProperty(ctx context.Context, property ingestiondomain.Property) (ingestiondomain.Property, error) {
	normalized, err := s.normalizeAndValidateProperty(ctx, property)
	if err != nil {
		return ingestiondomain.Property{}, err
	}

	if err := s.store.UpsertProperty(ctx, normalized); err != nil {
		return ingestiondomain.Property{}, err
	}

	return normalized, nil
}

// ListProperties returns all tracked properties.
func (s *PropertyService) ListProperties(ctx context.Context) ([]ingestiondomain.Property, error) {
	return s.store.ListProperties(ctx)
}

// GetProperty returns one property by identifier.
func (s *PropertyService) GetProperty(ctx context.Context, propertyID string) (ingestiondomain.Property, error) {
	property, err := s.store.GetProperty(ctx, propertyID)
	if errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.Property{}, ErrPropertyNotFound
	}

	return property, err
}

// UpsertPropertyConfig saves a new extraction config version for a property.
func (s *PropertyService) UpsertPropertyConfig(ctx context.Context, propertyID string, fields []ingestiondomain.FieldSelector) (ingestiondomain.PropertyExtractionConfig, error) {
	existing, err := s.store.GetLatestPropertyConfig(ctx, propertyID)
	if err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, err
	}
	normalizedFields, err := normalizeConfiguredFields(fields)
	if err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, err
	}

	nextVersion := existing.Version + 1
	now := s.clock.Now().UTC()

	config := ingestiondomain.PropertyExtractionConfig{
		ID:         id.New("pconf"),
		PropertyID: propertyID,
		Fields:     normalizedFields,
		Version:    nextVersion,
		CreatedAt:  now,
	}

	if err := s.store.UpsertPropertyConfig(ctx, config); err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, err
	}

	return config, nil
}

// GetLatestPropertyConfig returns the effective extraction config for a property.
func (s *PropertyService) GetLatestPropertyConfig(ctx context.Context, propertyID string) (ingestiondomain.PropertyExtractionConfig, error) {
	property, err := s.store.GetProperty(ctx, propertyID)
	if err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, err
	}

	config, err := s.store.GetLatestPropertyConfig(ctx, propertyID)
	if err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, err
	}

	config.PropertyID = propertyID
	config.Fields, err = s.resolveFields(ctx, property.SourceID, config.Fields)
	if err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, err
	}
	return config, nil
}

// ListPropertySnapshots returns recent runs for a property.
func (s *PropertyService) ListPropertySnapshots(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error) {
	return s.store.ListPropertySnapshots(ctx, propertyID, limit)
}

// ListRuns returns recent runs across all properties.
func (s *PropertyService) ListRuns(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error) {
	return s.store.ListAllPropertySnapshots(ctx, propertyID, limit)
}

// GetRun returns a single run by identifier.
func (s *PropertyService) GetRun(ctx context.Context, runID string) (ingestiondomain.PropertySnapshot, error) {
	return s.store.GetPropertySnapshot(ctx, runID)
}

// PreviewExtraction fetches and applies selectors without persisting any state.
func (s *PropertyService) PreviewExtraction(ctx context.Context, req ingestiondomain.PropertyPreviewRequest) (ingestiondomain.PropertyPreviewResult, error) {
	if err := validatePropertyURL(req.URL); err != nil {
		return ingestiondomain.PropertyPreviewResult{}, err
	}
	normalizedHeaders, err := normalizePropertyRequestHeaders(req.RequestHeaders)
	if err != nil {
		return ingestiondomain.PropertyPreviewResult{}, err
	}
	normalizedFields, err := normalizeConfiguredFields(req.Fields)
	if err != nil {
		return ingestiondomain.PropertyPreviewResult{}, err
	}

	body, err := s.fetchHTML(ctx, req.URL, propertyFetchOptions{
		BrowserEnabled: req.BrowserEnabled,
		RequestHeaders: normalizedHeaders,
	})
	if err != nil {
		return ingestiondomain.PropertyPreviewResult{}, fmt.Errorf("fetch page: %w", err)
	}

	values, failures, fieldResults := applySelectors(body, normalizedFields)

	return ingestiondomain.PropertyPreviewResult{
		Fields:   fieldResults,
		Values:   values,
		Failures: failures,
		Success:  len(failures) == 0,
	}, nil
}

// IngestProperty fetches, extracts, and records one snapshot for a property.
func (s *PropertyService) IngestProperty(ctx context.Context, propertyID string) (ingestiondomain.PropertySnapshot, error) {
	property, err := s.store.GetProperty(ctx, propertyID)
	if errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.PropertySnapshot{}, ErrPropertyNotFound
	}
	if err != nil {
		return ingestiondomain.PropertySnapshot{}, err
	}

	config, err := s.store.GetLatestPropertyConfig(ctx, propertyID)
	if err != nil {
		return ingestiondomain.PropertySnapshot{}, err
	}
	config.Fields, err = s.resolveFields(ctx, property.SourceID, config.Fields)
	if err != nil {
		return ingestiondomain.PropertySnapshot{}, err
	}
	if len(config.Fields) == 0 {
		return ingestiondomain.PropertySnapshot{}, fmt.Errorf("property extraction config is required")
	}

	now := s.clock.Now().UTC()
	lastValid, _ := s.store.GetLastValidPropertySnapshot(ctx, propertyID)

	body, fetchErr := s.fetchHTML(ctx, property.URL, propertyFetchOptions{
		BrowserEnabled: property.BrowserEnabled,
		RequestHeaders: property.RequestHeaders,
	})
	if fetchErr != nil {
		snapshot := ingestiondomain.PropertySnapshot{
			ID:            id.New("run"),
			PropertyID:    propertyID,
			ConfigVersion: config.Version,
			ObservedAt:    now,
			Values:        json.RawMessage("{}"),
			ChangeFlags:   json.RawMessage("{}"),
			IsValid:       false,
			ErrorMessage:  fetchErr.Error(),
		}
		_ = s.store.CreatePropertySnapshot(ctx, snapshot)
		_ = s.store.UpdatePropertyRunState(ctx, propertyID, ingestiondomain.PropertyStatusDegraded, &now, nextPropertyRunAt(now, property.ScheduleInterval()))
		s.emit("property.run.failed", map[string]any{"property_id": propertyID, "error": fetchErr.Error()})

		return snapshot, nil
	}

	values, failures, _ := applySelectors(body, config.Fields)
	isValid := true
	for _, field := range config.Fields {
		if field.Required {
			if v, ok := values[field.Name]; !ok || strings.TrimSpace(v) == "" {
				isValid = false
				break
			}
		}
	}

	var errorMessage string
	if len(failures) > 0 {
		errorMessage = strings.Join(failures, "; ")
	}

	changeFlags := map[string]bool{}
	if lastValid.ID != "" && lastValid.IsValid {
		previousValues := decodeSnapshotValues(lastValid.Values)
		for key, newValue := range values {
			if oldValue, ok := previousValues[key]; ok && oldValue != newValue {
				changeFlags[key] = true
			}
		}
	}

	valuesJSON, _ := json.Marshal(values)
	changeFlagsJSON, _ := json.Marshal(changeFlags)
	status := ingestiondomain.PropertyStatusActive
	if !isValid {
		status = ingestiondomain.PropertyStatusDegraded
	}

	snapshot := ingestiondomain.PropertySnapshot{
		ID:            id.New("run"),
		PropertyID:    propertyID,
		ConfigVersion: max(config.Version, 1),
		ObservedAt:    now,
		Values:        json.RawMessage(valuesJSON),
		ChangeFlags:   json.RawMessage(changeFlagsJSON),
		IsValid:       isValid,
		ErrorMessage:  errorMessage,
	}

	if err := s.store.CreatePropertySnapshot(ctx, snapshot); err != nil {
		return ingestiondomain.PropertySnapshot{}, err
	}

	nextRun := nextPropertyRunAt(now, property.ScheduleInterval())
	if err := s.store.UpdatePropertyRunState(ctx, propertyID, status, &now, nextRun); err != nil {
		return ingestiondomain.PropertySnapshot{}, err
	}

	if s.changes != nil {
		if _, err := s.changes.ProcessPropertyRun(ctx, propertyID, snapshot, lastValid); err != nil {
			return ingestiondomain.PropertySnapshot{}, err
		}
	}

	s.emit("property.run.completed", map[string]any{
		"property_id":  propertyID,
		"is_valid":     isValid,
		"change_count": len(changeFlags),
	})

	if s.logger != nil {
		s.logger.Info("property ingest completed",
			"property_id", propertyID,
			"is_valid", isValid,
			"status", string(status),
		)
	}

	return snapshot, nil
}

// normalizeAndValidateProperty applies defaults and validates the property before save.
func (s *PropertyService) normalizeAndValidateProperty(ctx context.Context, property ingestiondomain.Property) (ingestiondomain.Property, error) {
	if err := validatePropertyURL(property.URL); err != nil {
		return ingestiondomain.Property{}, err
	}
	normalizedHeaders, err := normalizePropertyRequestHeaders(property.RequestHeaders)
	if err != nil {
		return ingestiondomain.Property{}, err
	}
	property.RequestHeaders = normalizedHeaders
	property.SourceID = strings.TrimSpace(property.SourceID)
	if property.SourceID != "" {
		if _, err := s.store.GetSource(ctx, property.SourceID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ingestiondomain.Property{}, fmt.Errorf("source not found")
			}
			return ingestiondomain.Property{}, err
		}
	}

	now := s.clock.Now().UTC()
	if property.ID == "" {
		property.ID = id.New("prop")
	}
	if property.Status == "" {
		property.Status = ingestiondomain.PropertyStatusPending
	}
	if property.RetryMaxAttempts <= 0 {
		property.RetryMaxAttempts = 1
	}
	if property.RetryBackoffMillis <= 0 {
		property.RetryBackoffMillis = 500
	}
	property.UpdatedAt = now
	if property.CreatedAt.IsZero() {
		property.CreatedAt = now
	}

	return property, nil
}

func (s *PropertyService) resolveFields(ctx context.Context, sourceID string, customFields []ingestiondomain.FieldSelector) ([]ingestiondomain.FieldSelector, error) {
	resolved := make([]ingestiondomain.FieldSelector, 0)
	indexByName := make(map[string]int)

	if strings.TrimSpace(sourceID) != "" {
		source, err := s.store.GetSource(ctx, sourceID)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		for _, field := range fieldsFromSource(source) {
			field.Name = strings.TrimSpace(field.Name)
			if field.Name == "" || strings.TrimSpace(field.SelectorValue) == "" {
				continue
			}
			indexByName[field.Name] = len(resolved)
			resolved = append(resolved, field)
		}
	}

	for _, field := range customFields {
		field.Name = strings.TrimSpace(field.Name)
		if field.Name == "" || strings.TrimSpace(field.SelectorValue) == "" {
			continue
		}
		if idx, ok := indexByName[field.Name]; ok {
			resolved[idx] = field
			continue
		}
		indexByName[field.Name] = len(resolved)
		resolved = append(resolved, field)
	}

	return resolved, nil
}

func fieldsFromSource(source ingestiondomain.Source) []ingestiondomain.FieldSelector {
	if strings.TrimSpace(source.ConfigJSON) == "" {
		return nil
	}
	var fields []ingestiondomain.FieldSelector
	if err := json.Unmarshal([]byte(source.ConfigJSON), &fields); err == nil {
		return fields
	}
	var payload struct {
		Fields []ingestiondomain.FieldSelector `json:"fields"`
	}
	if err := json.Unmarshal([]byte(source.ConfigJSON), &payload); err == nil {
		return payload.Fields
	}
	return nil
}

func decodeSnapshotValues(values json.RawMessage) map[string]string {
	if len(values) == 0 {
		return map[string]string{}
	}
	decoded := make(map[string]string)
	if err := json.Unmarshal(values, &decoded); err != nil {
		return map[string]string{}
	}
	return decoded
}

// emit publishes a named event if a broker is wired.
func (s *PropertyService) emit(eventType string, data any) {
	if s.events != nil {
		s.events.Publish(eventType, data)
	}
}

// validatePropertyURL ensures the URL is a well-formed http or https URL.
func validatePropertyURL(rawURL string) error {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return fmt.Errorf("property URL is required")
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid property URL: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("property URL must use http or https")
	}
	if parsed.Host == "" {
		return fmt.Errorf("property URL host is required")
	}
	if err := validateFetchHost(parsed.Hostname()); err != nil {
		return err
	}
	return nil
}

func (s *PropertyService) fetchHTML(ctx context.Context, targetURL string, options propertyFetchOptions) ([]byte, error) {
	parsed, err := url.Parse(strings.TrimSpace(targetURL))
	if err != nil {
		return nil, err
	}
	if err := validateFetchHost(parsed.Hostname()); err != nil {
		return nil, err
	}

	response, err := s.fetcher.Fetch(ctx, fetcher.Request{
		URL:                parsed.String(),
		Accept:             "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		DefaultContentType: "text/html; charset=utf-8",
		BrowserEnabled:     options.BrowserEnabled,
		Headers:            options.RequestHeaders,
		SessionKey:         parsed.Hostname(),
	})
	if err != nil {
		return nil, err
	}
	if looksLikeAntiBotChallenge(response.Payload) {
		return nil, fmt.Errorf("portal returned an anti-bot challenge page")
	}

	return response.Payload, nil
}

func looksLikeAntiBotChallenge(body []byte) bool {
	if len(body) == 0 {
		return false
	}
	lowered := strings.ToLower(string(body))
	for _, marker := range antiBotChallengeMarkers {
		if strings.Contains(lowered, marker) {
			return true
		}
	}
	return false
}

func normalizePropertyRequestHeaders(headers map[string]string) (map[string]string, error) {
	if len(headers) == 0 {
		return nil, nil
	}

	normalized := make(map[string]string, len(headers))
	for name, value := range headers {
		canonicalName := http.CanonicalHeaderKey(strings.TrimSpace(name))
		if canonicalName == "" {
			return nil, fmt.Errorf("request header name is required")
		}
		if _, ok := supportedPropertyRequestHeaders[canonicalName]; !ok {
			return nil, fmt.Errorf("request header %q is not supported", canonicalName)
		}
		trimmedValue := strings.TrimSpace(value)
		if trimmedValue == "" {
			continue
		}
		if strings.ContainsAny(canonicalName, "\r\n") || strings.ContainsAny(trimmedValue, "\r\n") {
			return nil, fmt.Errorf("request header %q contains invalid characters", canonicalName)
		}
		normalized[canonicalName] = trimmedValue
	}
	if len(normalized) == 0 {
		return nil, nil
	}
	return normalized, nil
}

func validateFetchHost(host string) error {
	host = strings.TrimSpace(strings.ToLower(host))
	if host == "" {
		return fmt.Errorf("property URL host is required")
	}
	if host == "localhost" {
		return fmt.Errorf("localhost is not allowed")
	}
	if ip := net.ParseIP(host); ip != nil {
		if ip.IsPrivate() || ip.IsLinkLocalMulticast() || ip.IsLinkLocalUnicast() || ip.IsMulticast() || ip.IsUnspecified() {
			return fmt.Errorf("private network hosts are not allowed")
		}
	}
	return nil
}

func applySelectors(body []byte, fields []ingestiondomain.FieldSelector) (map[string]string, []string, []ingestiondomain.PropertyPreviewFieldResult) {
	rootNode, err := html.Parse(bytes.NewReader(body))
	if err != nil {
		return map[string]string{}, []string{fmt.Sprintf("parse html: %v", err)}, []ingestiondomain.PropertyPreviewFieldResult{}
	}
	document := goquery.NewDocumentFromNode(rootNode)

	values := make(map[string]string, len(fields))
	failures := make([]string, 0)
	fieldResults := make([]ingestiondomain.PropertyPreviewFieldResult, 0, len(fields))
	for _, field := range fields {
		result := selectFieldValue(document, rootNode, field)
		fieldResults = append(fieldResults, result)
		if !result.Success {
			failures = append(failures, fmt.Sprintf("%s: %s", field.Name, result.Message))
			continue
		}
		values[field.Name] = result.Value
	}
	return values, failures, fieldResults
}

func selectFieldValue(document *goquery.Document, rootNode *html.Node, field ingestiondomain.FieldSelector) ingestiondomain.PropertyPreviewFieldResult {
	result := ingestiondomain.PropertyPreviewFieldResult{
		ExtractionMode: field.ExtractionMode,
		Name:           field.Name,
		SelectorType:   field.SelectorType,
		SelectorValue:  field.SelectorValue,
		TextMode:       field.TextMode,
	}
	selectors := append([]string{field.SelectorValue}, field.FallbackSelectors...)
	for index, selector := range selectors {
		nodes, err := querySelectorNodes(document, rootNode, field, selector)
		if err != nil {
			result.Message = err.Error()
			continue
		}
		if len(nodes) == 0 {
			continue
		}
		result.MatchCount = len(nodes)

		value, ok := extractNodeValue(nodes[0], field)
		if !ok {
			result.Message = missingValueMessage(field)
			continue
		}

		switch strings.TrimSpace(strings.ToLower(field.Transform)) {
		case "number":
			value = normalizeNumberString(value)
		case "trim", "":
		}

		if value != "" {
			result.MatchedSelector = selector
			result.Message = "Ready"
			result.Success = true
			result.UsedFallback = index > 0
			result.Value = value
			if len(nodes) > 1 {
				result.Message = fmt.Sprintf("%d matches found. Using the first result.", len(nodes))
			}
			return result
		}
		result.Message = "The matched element was empty."
	}
	if result.Message == "" {
		result.Message = "No selector matched."
	}
	return result
}

func querySelectorNodes(document *goquery.Document, rootNode *html.Node, field ingestiondomain.FieldSelector, selector string) ([]*html.Node, error) {
	trimmedSelector := strings.TrimSpace(selector)
	if trimmedSelector == "" {
		return nil, nil
	}

	switch resolveSelectorStrategy(field.SelectorType) {
	case ingestiondomain.SelectorTypeCSS:
		selection := document.Find(trimmedSelector)
		nodes := make([]*html.Node, 0, selection.Length())
		selection.Each(func(_ int, item *goquery.Selection) {
			nodes = append(nodes, item.Nodes...)
		})
		return nodes, nil
	case ingestiondomain.SelectorTypeXPath:
		if err := validateXPathSelector(trimmedSelector); err != nil {
			return nil, err
		}
		nodes, err := htmlquery.QueryAll(rootNode, trimmedSelector)
		if err != nil {
			return nil, fmt.Errorf("invalid XPath selector")
		}
		return nodes, nil
	default:
		return nil, fmt.Errorf("unsupported selector type")
	}
}

func extractNodeValue(node *html.Node, field ingestiondomain.FieldSelector) (string, bool) {
	if field.ExtractionMode == ingestiondomain.ExtractionModeAttribute || field.SelectorType == ingestiondomain.SelectorTypeAttribute {
		attributeName := strings.TrimSpace(field.Attribute)
		if attributeName == "" {
			return "", false
		}
		for _, attribute := range node.Attr {
			if attribute.Key == attributeName {
				return strings.TrimSpace(attribute.Val), true
			}
		}
		return "", false
	}

	value := strings.TrimSpace(goquery.NewDocumentFromNode(node).Text())
	return value, value != ""
}

func missingValueMessage(field ingestiondomain.FieldSelector) string {
	if field.ExtractionMode == ingestiondomain.ExtractionModeAttribute || field.SelectorType == ingestiondomain.SelectorTypeAttribute {
		return fmt.Sprintf("Attribute %q was not found.", field.Attribute)
	}
	return "The matched element was empty."
}

func resolveSelectorStrategy(selectorType ingestiondomain.SelectorType) ingestiondomain.SelectorType {
	switch selectorType {
	case ingestiondomain.SelectorTypeXPath:
		return ingestiondomain.SelectorTypeXPath
	case ingestiondomain.SelectorTypeAttribute, ingestiondomain.SelectorTypeText, ingestiondomain.SelectorTypeCSS, "":
		return ingestiondomain.SelectorTypeCSS
	default:
		return ""
	}
}

func normalizeConfiguredFields(fields []ingestiondomain.FieldSelector) ([]ingestiondomain.FieldSelector, error) {
	if len(fields) == 0 {
		return nil, fmt.Errorf("at least one field is required")
	}

	normalized := make([]ingestiondomain.FieldSelector, 0, len(fields))
	names := make(map[string]struct{}, len(fields))
	for _, field := range fields {
		field.Name = strings.TrimSpace(field.Name)
		field.SelectorValue = strings.TrimSpace(field.SelectorValue)
		field.Attribute = strings.TrimSpace(field.Attribute)
		field.Transform = strings.TrimSpace(field.Transform)
		field.FallbackSelectors = ingestiondomain.NormalizeSelectorList(field.FallbackSelectors)

		if field.Name == "" {
			return nil, fmt.Errorf("field name is required")
		}
		if _, exists := names[field.Name]; exists {
			return nil, fmt.Errorf("field %q is duplicated", field.Name)
		}
		names[field.Name] = struct{}{}
		if field.SelectorValue == "" {
			return nil, fmt.Errorf("field %q must include a selector", field.Name)
		}
		if field.SelectorType == "" {
			if field.ExtractionMode == ingestiondomain.ExtractionModeAttribute || field.Attribute != "" {
				field.SelectorType = ingestiondomain.SelectorTypeAttribute
			} else {
				field.SelectorType = ingestiondomain.SelectorTypeCSS
			}
		}

		switch resolveSelectorStrategy(field.SelectorType) {
		case ingestiondomain.SelectorTypeCSS, ingestiondomain.SelectorTypeXPath:
		default:
			return nil, fmt.Errorf("field %q uses an unsupported selector type", field.Name)
		}
		if field.SelectorType == ingestiondomain.SelectorTypeXPath {
			if err := validateXPathSelector(field.SelectorValue); err != nil {
				return nil, fmt.Errorf("field %q %w", field.Name, err)
			}
			for _, fallbackSelector := range field.FallbackSelectors {
				if err := validateXPathSelector(fallbackSelector); err != nil {
					return nil, fmt.Errorf("field %q %w", field.Name, err)
				}
			}
		}

		if field.ExtractionMode == "" {
			if field.SelectorType == ingestiondomain.SelectorTypeAttribute || field.Attribute != "" {
				field.ExtractionMode = ingestiondomain.ExtractionModeAttribute
			} else {
				field.ExtractionMode = ingestiondomain.ExtractionModeText
			}
		}
		switch field.ExtractionMode {
		case ingestiondomain.ExtractionModeText, ingestiondomain.ExtractionModeAttribute:
		default:
			return nil, fmt.Errorf("field %q uses an unsupported extraction mode", field.Name)
		}

		if field.ExtractionMode == ingestiondomain.ExtractionModeAttribute && field.Attribute == "" {
			return nil, fmt.Errorf("field %q needs an attribute name", field.Name)
		}
		if field.ExtractionMode == ingestiondomain.ExtractionModeText && field.TextMode == "" {
			field.TextMode = ingestiondomain.TextModeInnerText
		}
		normalized = append(normalized, field)
	}

	return normalized, nil
}

func validateXPathSelector(selector string) error {
	trimmedSelector := strings.TrimSpace(selector)
	if trimmedSelector == "" {
		return fmt.Errorf("needs a valid XPath selector")
	}
	if strings.ContainsAny(trimmedSelector, "()|$;\\") {
		return fmt.Errorf("uses unsupported XPath syntax")
	}
	if !xpathSelectorPattern.MatchString(trimmedSelector) {
		return fmt.Errorf("uses unsupported XPath syntax")
	}
	return nil
}

func normalizeNumberString(value string) string {
	var digits strings.Builder
	for _, char := range value {
		if char >= '0' && char <= '9' {
			digits.WriteRune(char)
		}
	}
	return digits.String()
}

func nextPropertyRunAt(now time.Time, interval time.Duration) *time.Time {
	if interval <= 0 {
		return nil
	}
	nextRun := now.Add(interval)
	return &nextRun
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
