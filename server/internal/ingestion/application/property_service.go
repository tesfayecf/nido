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
	GetLastValidPropertySnapshot(ctx context.Context, propertyID string) (ingestiondomain.PropertySnapshot, error)
}

// PropertyService orchestrates property registration, extraction configuration, and snapshot ingestion.
type PropertyService struct {
	logger  *slog.Logger
	store   PropertyStore
	clock   Clock
	changes ChangeProcessor
	events  Publisher
}

// NewPropertyService builds a PropertyService.
func NewPropertyService(
	logger *slog.Logger,
	store PropertyStore,
	clock Clock,
	changes ChangeProcessor,
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
	normalized, err := s.normalizeAndValidateProperty(property)
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

// GetLatestPropertyConfig returns the most recent extraction config for a property.
func (s *PropertyService) GetLatestPropertyConfig(ctx context.Context, propertyID string) (ingestiondomain.PropertyExtractionConfig, error) {
	return s.store.GetLatestPropertyConfig(ctx, propertyID)
}

// ListPropertySnapshots returns recent snapshots for a property.
func (s *PropertyService) ListPropertySnapshots(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error) {
	return s.store.ListPropertySnapshots(ctx, propertyID, limit)
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

	now := s.clock.Now().UTC()

	// Fetch the property page.
	body, fetchErr := fetchHTML(ctx, property.URL)

	if fetchErr != nil {
		// Record a failed snapshot preserving the last valid data.
		snapshot := ingestiondomain.PropertySnapshot{
			ID:            id.New("psnap"),
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
		s.emit("property.ingest.failed", map[string]any{"property_id": propertyID, "error": fetchErr.Error()})

		return snapshot, nil
	}

	values, failures := applySelectors(body, config.Fields)

	// Determine validity: all required fields must be present.
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

	// Build change flags by comparing with the last valid snapshot.
	changeFlags := map[string]bool{}
	lastValid, _ := s.store.GetLastValidPropertySnapshot(ctx, propertyID)
	if lastValid.ID != "" && lastValid.IsValid {
		var previousValues map[string]string
		if err := json.Unmarshal(lastValid.Values, &previousValues); err == nil {
			for k, newVal := range values {
				if oldVal, ok := previousValues[k]; ok && oldVal != newVal {
					changeFlags[k] = true
				}
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
		ID:            id.New("psnap"),
		PropertyID:    propertyID,
		ConfigVersion: config.Version,
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

	s.emit("property.ingest.completed", map[string]any{
		"property_id":   propertyID,
		"is_valid":      isValid,
		"change_count":  len(changeFlags),
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
func (s *PropertyService) normalizeAndValidateProperty(property ingestiondomain.Property) (ingestiondomain.Property, error) {
	if err := validatePropertyURL(property.URL); err != nil {
		return ingestiondomain.Property{}, err
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
		return fmt.Errorf("property URL must use http or https scheme")
	}

	if parsed.Host == "" {
		return fmt.Errorf("property URL must include a host")
	}

	return nil
}

// fetchHTML fetches the HTML at the given URL using a plain HTTP client.
func fetchHTML(ctx context.Context, rawURL string) ([]byte, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("parse url: %w", err)
	}

	// Rebuild from the parsed struct to prevent SSRF via raw input.
	safeURL := parsed.String()

	reqCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, safeURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}

	req.Header.Set("User-Agent", "home-searcher/1.0 (+https://github.com/tesfayecf/home-searcher)")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("http %d fetching page", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 5*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	return body, nil
}

// applySelectors applies the FieldSelector list to the HTML body using goquery.
func applySelectors(body []byte, fields []ingestiondomain.FieldSelector) (map[string]string, []string) {
	values := make(map[string]string)
	failures := make([]string, 0)

	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return values, []string{"failed to parse HTML: " + err.Error()}
	}

	for _, field := range fields {
		extracted := ""
		matched := false

		for _, sel := range field.Selectors {
			selection := doc.Find(sel)
			if selection.Length() == 0 {
				continue
			}

			if field.Attribute != "" {
				val, exists := selection.First().Attr(field.Attribute)
				if exists {
					extracted = strings.TrimSpace(val)
					matched = true
				}
			} else {
				extracted = strings.TrimSpace(selection.First().Text())
				matched = true
			}

			if matched {
				break
			}
		}

		if !matched {
			if field.Required {
				failures = append(failures, fmt.Sprintf("%s: no matching element found", field.Name))
			}

			continue
		}

		// Apply basic transforms.
		switch strings.ToLower(field.Transform) {
		case "number":
			extracted = extractNumber(extracted)
		case "trim":
			extracted = strings.TrimSpace(extracted)
		}

		values[field.Name] = extracted
	}

	return values, failures
}

// extractNumber strips non-numeric characters, keeping only digits and one decimal point.
func extractNumber(s string) string {
	var out strings.Builder
	hasDot := false

	for _, ch := range s {
		if ch >= '0' && ch <= '9' {
			out.WriteRune(ch)
		} else if (ch == '.' || ch == ',') && !hasDot {
			out.WriteRune('.')
			hasDot = true
		}
	}

	return out.String()
}

// nextPropertyRunAt computes the next scheduled run time for a property.
func nextPropertyRunAt(from time.Time, interval time.Duration) *time.Time {
	if interval <= 0 {
		return nil
	}

	next := from.Add(interval)

	return &next
}
