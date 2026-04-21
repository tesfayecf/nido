package application

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"

	ingestiondomain "home-searcher/server/internal/ingestion/domain"
	"home-searcher/server/internal/platform/id"
)

// ErrPropertyNotFound indicates that the requested property does not exist.
var ErrPropertyNotFound = errors.New("property not found")

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
	clock   Clock
	changes PropertyRunProcessor
	events  Publisher
}

// NewPropertyService builds a PropertyService.
func NewPropertyService(
	logger *slog.Logger,
	store PropertyStore,
	clock Clock,
	changes PropertyRunProcessor,
	events Publisher,
) *PropertyService {
	resolvedClock := clock
	if resolvedClock == nil {
		resolvedClock = systemClock{}
	}

	return &PropertyService{
		logger:  logger,
		store:   store,
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

	nextVersion := existing.Version + 1
	now := s.clock.Now().UTC()

	config := ingestiondomain.PropertyExtractionConfig{
		ID:         id.New("pconf"),
		PropertyID: propertyID,
		Fields:     fields,
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

	body, err := fetchHTML(ctx, req.URL)
	if err != nil {
		return ingestiondomain.PropertyPreviewResult{}, fmt.Errorf("fetch page: %w", err)
	}

	values, failures := applySelectors(body, req.Fields)

	return ingestiondomain.PropertyPreviewResult{
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

	body, fetchErr := fetchHTML(ctx, property.URL)
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

	values, failures := applySelectors(body, config.Fields)
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
			if field.Name == "" {
				continue
			}
			indexByName[field.Name] = len(resolved)
			resolved = append(resolved, field)
		}
	}

	for _, field := range customFields {
		field.Name = strings.TrimSpace(field.Name)
		if field.Name == "" {
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
	return nil
}

func fetchHTML(ctx context.Context, targetURL string) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("unexpected status %d", response.StatusCode)
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}

func applySelectors(body []byte, fields []ingestiondomain.FieldSelector) (map[string]string, []string) {
	document, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return map[string]string{}, []string{fmt.Sprintf("parse html: %v", err)}
	}

	values := make(map[string]string, len(fields))
	failures := make([]string, 0)
	for _, field := range fields {
		value, ok := selectFieldValue(document, field)
		if !ok {
			failures = append(failures, fmt.Sprintf("%s: no selector matched", field.Name))
			continue
		}
		values[field.Name] = value
	}
	return values, failures
}

func selectFieldValue(document *goquery.Document, field ingestiondomain.FieldSelector) (string, bool) {
	for _, selector := range field.Selectors {
		selection := document.Find(selector).First()
		if selection.Length() == 0 {
			continue
		}

		value := strings.TrimSpace(selection.Text())
		if strings.TrimSpace(field.Attribute) != "" {
			attributeValue, ok := selection.Attr(field.Attribute)
			if !ok {
				continue
			}
			value = strings.TrimSpace(attributeValue)
		}

		switch strings.TrimSpace(strings.ToLower(field.Transform)) {
		case "number":
			value = normalizeNumberString(value)
		case "trim", "":
		}

		if value != "" {
			return value, true
		}
	}
	return "", false
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
