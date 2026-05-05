/**
 * File: internal/ingestion/application/property_service.go
 *
 * Purpose:
 * Coordinates application-level backend use cases, validation, and persistence boundaries.
 *
 * Responsibilities:
 * - Apply business rules
 * - Coordinate repositories and domain models
 * - Return typed results for transport layers
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - bytes
 * - context
 * - database/sql
 * - encoding/json
 * - errors
 * - fmt
 * - log/slog
 * - net
 * - net/http
 * - net/url
 * - regexp
 * - strings
 * - time
 * - github.com/PuerkitoBio/goquery
 * - github.com/antchfx/htmlquery
 * - golang.org/x/net/html
 * - nido/server/internal/fetcher
 * - nido/server/internal/ingestion/domain
 * - nido/server/internal/platform/id
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

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

	"nido/server/internal/fetcher"
	ingestiondomain "nido/server/internal/ingestion/domain"
	"nido/server/internal/platform/id"
)

// ErrPropertyNotFound indicates that the requested property does not exist.
var ErrPropertyNotFound = errors.New("property not found")

// ErrPropertyRunNotFound indicates that the requested property snapshot does not exist.
var ErrPropertyRunNotFound = errors.New("run not found")

var xpathSelectorPattern = regexp.MustCompile(`^/{1,2}[-@/\[\]\w\s="'._:*]+$`)

var supportedPropertyRequestHeaders = map[string]struct{}{
	"Accept":                    {},
	"Accept-Language":           {},
	"Cookie":                    {},
	"Referer":                   {},
	"Sec-Ch-Ua":                 {},
	"Sec-Ch-Ua-Mobile":          {},
	"Sec-Ch-Ua-Platform":        {},
	"Sec-Fetch-Dest":            {},
	"Sec-Fetch-Mode":            {},
	"Sec-Fetch-Site":            {},
	"Sec-Fetch-User":            {},
	"Upgrade-Insecure-Requests": {},
	"User-Agent":                {},
}

/**
 * Purpose:
 * Defines the propertyFetchOptions struct used by this package and its consumers.
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
type propertyFetchOptions struct {
	BrowserEnabled bool
	RequestHeaders map[string]string
}

/**
 * Purpose:
 * Defines the PropertyStore interface used by this package and its consumers.
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
type PropertyStore interface {
	UpsertProperty(ctx context.Context, property ingestiondomain.Property) error
	ListProperties(ctx context.Context) ([]ingestiondomain.Property, error)
	GetProperty(ctx context.Context, propertyID string) (ingestiondomain.Property, error)
	DeleteProperty(ctx context.Context, propertyID string) error
	UpdatePropertyRunState(ctx context.Context, propertyID string, status ingestiondomain.PropertyStatus, lastRunAt, nextRunAt *time.Time) error
	CreatePropertyRun(ctx context.Context, run ingestiondomain.PropertyRun) error
	UpsertPropertyConfig(ctx context.Context, config ingestiondomain.PropertyExtractionConfig) error
	GetLatestPropertyConfig(ctx context.Context, propertyID string) (ingestiondomain.PropertyExtractionConfig, error)
	ListPropertyConfigs(ctx context.Context, propertyID string) ([]ingestiondomain.PropertyExtractionConfig, error)
	GetPropertyConfigVersion(ctx context.Context, propertyID string, version int) (ingestiondomain.PropertyExtractionConfig, error)
	CreatePropertySnapshot(ctx context.Context, snapshot ingestiondomain.PropertySnapshot) error
	UpsertPropertyFieldValues(ctx context.Context, snapshot ingestiondomain.PropertySnapshot, fields []ingestiondomain.FieldSelector) error
	ListPropertySnapshots(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error)
	ListAllPropertySnapshots(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error)
	GetPropertySnapshot(ctx context.Context, snapshotID string) (ingestiondomain.PropertySnapshot, error)
	DeletePropertySnapshot(ctx context.Context, snapshotID string) error
	GetLastValidPropertySnapshot(ctx context.Context, propertyID string) (ingestiondomain.PropertySnapshot, error)
	GetSource(ctx context.Context, sourceID string) (ingestiondomain.Source, error)
	ListPropertiesByTagIDs(ctx context.Context, tagIDs []string, matchAll bool) ([]string, error)
	ListPropertyRuns(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertyRun, error)
	// GetLatestPropertySnapshots returns up to n most-recent snapshots for a property (any validity).
	GetLatestPropertySnapshots(ctx context.Context, propertyID string, n int) ([]ingestiondomain.PropertySnapshot, error)
}

/**
 * Purpose:
 * Defines the PropertyRunProcessor interface used by this package and its consumers.
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
type PropertyRunProcessor interface {
	ProcessPropertyRun(ctx context.Context, propertyID string, current, previous ingestiondomain.PropertySnapshot) (int, error)
}

/**
 * Purpose:
 * Defines the PropertyService struct used by this package and its consumers.
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
type PropertyService struct {
	logger  *slog.Logger
	store   PropertyStore
	fetcher fetcher.Client
	clock   Clock
	changes PropertyRunProcessor
	events  Publisher
}

/**
 * Purpose:
 * Performs the NewPropertyService operation for this backend package.
 *
 * Parameters:
 * - logger *slog.Logger, store PropertyStore, client fetcher.Client, clock Clock, changes PropertyRunProcessor, events Publisher
 *
 * Returns:
 * - *PropertyService
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

/**
 * Purpose:
 * Performs the EnsureProperty operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - EnsureProperty(ctx context.Context, property ingestiondomain.Property) (ingestiondomain.Property, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) EnsureProperty(ctx context.Context, property ingestiondomain.Property) (ingestiondomain.Property, error) {
	normalized, err := s.normalizeAndValidateProperty(ctx, property)
	if err != nil {
		return ingestiondomain.Property{}, err
	}

	// Check if property exists to determine if it's create or update
	isUpdate := false
	if normalized.ID != "" {
		_, err := s.store.GetProperty(ctx, normalized.ID)
		isUpdate = !errors.Is(err, sql.ErrNoRows)
	}

	if err := s.store.UpsertProperty(ctx, normalized); err != nil {
		return ingestiondomain.Property{}, err
	}

	if isUpdate {
		s.emit("property.updated", map[string]any{"property_id": normalized.ID})
	} else {
		s.emit("property.created", map[string]any{"property_id": normalized.ID})
	}

	return normalized, nil
}

/**
 * Purpose:
 * Performs the UpsertPropertyWithManualData operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - UpsertPropertyWithManualData( ctx context.Context, property ingestiondomain.Property, manualValues map[string]string, ) (ingestiondomain.Property, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) UpsertPropertyWithManualData(
	ctx context.Context,
	property ingestiondomain.Property,
	manualValues map[string]string,
) (ingestiondomain.Property, error) {
	saved, err := s.EnsureProperty(ctx, property)
	if err != nil {
		return ingestiondomain.Property{}, err
	}
	if len(manualValues) == 0 {
		return saved, nil
	}

	if _, err := s.recordManualSnapshot(ctx, saved, manualValues); err != nil {
		return ingestiondomain.Property{}, err
	}

	refreshed, err := s.store.GetProperty(ctx, saved.ID)
	if err != nil {
		return ingestiondomain.Property{}, err
	}

	return refreshed, nil
}

/**
 * Purpose:
 * Performs the ListPropertiesFiltered operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - ListPropertiesFiltered(ctx context.Context, tagIDs []string, matchAll bool, status string, priorityLevel string, businessStage string) ([]ingestiondomain.Property, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) ListPropertiesFiltered(ctx context.Context, tagIDs []string, matchAll bool, status string, priorityLevel string, businessStage string) ([]ingestiondomain.Property, error) {
	if len(tagIDs) == 0 && status == "" && priorityLevel == "" && businessStage == "" {
		return s.store.ListProperties(ctx)
	}

	// Get properties from tag filter first if applicable
	var propertyIDsFromTags []string
	if len(tagIDs) > 0 {
		var err error
		propertyIDsFromTags, err = s.store.ListPropertiesByTagIDs(ctx, tagIDs, matchAll)
		if err != nil {
			return nil, err
		}
		// If no properties match tags, return empty
		if len(propertyIDsFromTags) == 0 {
			return []ingestiondomain.Property{}, nil
		}
	}

	// Get all properties and filter
	allProperties, err := s.store.ListProperties(ctx)
	if err != nil {
		return nil, err
	}

	filtered := make([]ingestiondomain.Property, 0)
	propertyIDSet := make(map[string]bool)
	for _, pid := range propertyIDsFromTags {
		propertyIDSet[pid] = true
	}

	for _, property := range allProperties {
		// Filter by tag if applicable
		if len(tagIDs) > 0 && !propertyIDSet[property.ID] {
			continue
		}
		// Filter by status if applicable
		if status != "" && string(property.Status) != status {
			continue
		}
		if priorityLevel != "" && !strings.EqualFold(strings.TrimSpace(property.Metadata.PriorityLevel), priorityLevel) {
			continue
		}
		if businessStage != "" && !strings.EqualFold(strings.TrimSpace(property.Metadata.BusinessStage), businessStage) {
			continue
		}
		filtered = append(filtered, property)
	}

	return filtered, nil
}

/**
 * Purpose:
 * Performs the ListProperties operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - ListProperties(ctx context.Context) ([]ingestiondomain.Property, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) ListProperties(ctx context.Context) ([]ingestiondomain.Property, error) {
	return s.store.ListProperties(ctx)
}

/**
 * Purpose:
 * Performs the GetProperty operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - GetProperty(ctx context.Context, propertyID string) (ingestiondomain.Property, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) GetProperty(ctx context.Context, propertyID string) (ingestiondomain.Property, error) {
	property, err := s.store.GetProperty(ctx, propertyID)
	if errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.Property{}, ErrPropertyNotFound
	}

	return property, err
}

/**
 * Purpose:
 * Performs the DeleteProperty operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - DeleteProperty(ctx context.Context, propertyID string) error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) DeleteProperty(ctx context.Context, propertyID string) error {
	err := s.store.DeleteProperty(ctx, propertyID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrPropertyNotFound
	}

	return err
}

/**
 * Purpose:
 * Performs the UpsertPropertyConfig operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - UpsertPropertyConfig(ctx context.Context, propertyID string, fields []ingestiondomain.FieldSelector) (ingestiondomain.PropertyExtractionConfig, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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
		ID:            id.New("pconf"),
		PropertyID:    propertyID,
		Fields:        normalizedFields,
		Version:       nextVersion,
		CreatedAt:     now,
		ChangeSummary: summarizeConfigChange(existing.Fields, normalizedFields),
	}

	if err := s.store.UpsertPropertyConfig(ctx, config); err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, err
	}

	return config, nil
}

/**
 * Purpose:
 * Performs the ListPropertyConfigs operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - ListPropertyConfigs(ctx context.Context, propertyID string) ([]ingestiondomain.PropertyExtractionConfig, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) ListPropertyConfigs(ctx context.Context, propertyID string) ([]ingestiondomain.PropertyExtractionConfig, error) {
	return s.store.ListPropertyConfigs(ctx, propertyID)
}

/**
 * Purpose:
 * Performs the GetPropertyConfigVersion operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - GetPropertyConfigVersion(ctx context.Context, propertyID string, version int) (ingestiondomain.PropertyExtractionConfig, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) GetPropertyConfigVersion(ctx context.Context, propertyID string, version int) (ingestiondomain.PropertyExtractionConfig, error) {
	return s.store.GetPropertyConfigVersion(ctx, propertyID, version)
}

/**
 * Purpose:
 * Performs the RollbackPropertyConfig operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - RollbackPropertyConfig(ctx context.Context, propertyID string, version int) (ingestiondomain.PropertyExtractionConfig, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) RollbackPropertyConfig(ctx context.Context, propertyID string, version int) (ingestiondomain.PropertyExtractionConfig, error) {
	target, err := s.store.GetPropertyConfigVersion(ctx, propertyID, version)
	if err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, err
	}

	existing, err := s.store.GetLatestPropertyConfig(ctx, propertyID)
	if err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, err
	}

	next := ingestiondomain.PropertyExtractionConfig{
		ID:            id.New("pconf"),
		PropertyID:    propertyID,
		Fields:        target.Fields,
		Version:       existing.Version + 1,
		CreatedAt:     s.clock.Now().UTC(),
		ChangeSummary: fmt.Sprintf("Rollback to version %d. %s", version, summarizeConfigChange(existing.Fields, target.Fields)),
	}
	if err := s.store.UpsertPropertyConfig(ctx, next); err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, err
	}

	return next, nil
}

/**
 * Purpose:
 * Performs the GetLatestPropertyConfig operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - GetLatestPropertyConfig(ctx context.Context, propertyID string) (ingestiondomain.PropertyExtractionConfig, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

/**
 * Purpose:
 * Performs the summarizeConfigChange operation for this backend package.
 *
 * Parameters:
 * - previous, current []ingestiondomain.FieldSelector
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
 * - May read/write external state when invoked collaborators perform I/O.
 */
func summarizeConfigChange(previous, current []ingestiondomain.FieldSelector) string {
	previousByName := make(map[string]ingestiondomain.FieldSelector, len(previous))
	currentByName := make(map[string]ingestiondomain.FieldSelector, len(current))
	for _, field := range previous {
		previousByName[field.Name] = field
	}
	for _, field := range current {
		currentByName[field.Name] = field
	}

	added := 0
	removed := 0
	modified := 0
	for name, field := range currentByName {
		previousField, exists := previousByName[name]
		if !exists {
			added++
			continue
		}
		if !selectorsEqual(previousField, field) {
			modified++
		}
	}
	for name := range previousByName {
		if _, exists := currentByName[name]; !exists {
			removed++
		}
	}

	parts := make([]string, 0, 3)
	if added > 0 {
		parts = append(parts, fmt.Sprintf("%d added", added))
	}
	if modified > 0 {
		parts = append(parts, fmt.Sprintf("%d changed", modified))
	}
	if removed > 0 {
		parts = append(parts, fmt.Sprintf("%d removed", removed))
	}
	if len(parts) == 0 {
		return "No selector changes."
	}

	return fmt.Sprintf("Fields: %s.", strings.Join(parts, ", "))
}

/**
 * Purpose:
 * Performs the selectorsEqual operation for this backend package.
 *
 * Parameters:
 * - left, right ingestiondomain.FieldSelector
 *
 * Returns:
 * - bool
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func selectorsEqual(left, right ingestiondomain.FieldSelector) bool {
	if left.Name != right.Name ||
		left.FieldName != right.FieldName ||
		left.SelectorType != right.SelectorType ||
		left.SelectorValue != right.SelectorValue ||
		left.ExtractionMode != right.ExtractionMode ||
		left.FieldRole != right.FieldRole ||
		left.TextMode != right.TextMode ||
		left.Attribute != right.Attribute ||
		left.Transform != right.Transform ||
		left.Required != right.Required ||
		len(left.FallbackSelectors) != len(right.FallbackSelectors) {
		return false
	}

	for index, selector := range left.FallbackSelectors {
		if right.FallbackSelectors[index] != selector {
			return false
		}
	}

	return true
}

/**
 * Purpose:
 * Performs the ListPropertySnapshots operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - ListPropertySnapshots(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) ListPropertySnapshots(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error) {
	return s.store.ListPropertySnapshots(ctx, propertyID, limit)
}

/**
 * Purpose:
 * Performs the ListRuns operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - ListRuns(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) ListRuns(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error) {
	return s.store.ListAllPropertySnapshots(ctx, propertyID, limit)
}

/**
 * Purpose:
 * Performs the GetRun operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - GetRun(ctx context.Context, runID string) (ingestiondomain.PropertySnapshot, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) GetRun(ctx context.Context, runID string) (ingestiondomain.PropertySnapshot, error) {
	run, err := s.store.GetPropertySnapshot(ctx, runID)
	if errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.PropertySnapshot{}, ErrPropertyRunNotFound
	}

	return run, err
}

/**
 * Purpose:
 * Performs the ListPropertyRuns operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - ListPropertyRuns(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertyRun, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) ListPropertyRuns(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertyRun, error) {
	return s.store.ListPropertyRuns(ctx, propertyID, limit)
}

/**
 * Purpose:
 * Performs the GetPropertySummary operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - GetPropertySummary(ctx context.Context, propertyID string) (ingestiondomain.PropertySummary, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) GetPropertySummary(ctx context.Context, propertyID string) (ingestiondomain.PropertySummary, error) {
	property, err := s.store.GetProperty(ctx, propertyID)
	if errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.PropertySummary{}, ErrPropertyNotFound
	}
	if err != nil {
		return ingestiondomain.PropertySummary{}, err
	}
	return s.buildSummary(ctx, property)
}

/**
 * Purpose:
 * Performs the ListPropertySummaries operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - ListPropertySummaries(ctx context.Context, tagIDs []string, matchAll bool, status, priorityLevel, businessStage string) ([]ingestiondomain.PropertySummary, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) ListPropertySummaries(ctx context.Context, tagIDs []string, matchAll bool, status, priorityLevel, businessStage string) ([]ingestiondomain.PropertySummary, error) {
	properties, err := s.ListPropertiesFiltered(ctx, tagIDs, matchAll, status, priorityLevel, businessStage)
	if err != nil {
		return nil, err
	}
	summaries := make([]ingestiondomain.PropertySummary, 0, len(properties))
	for _, property := range properties {
		summary, err := s.buildSummary(ctx, property)
		if err != nil {
			// Non-fatal: skip broken properties
			s.logger.Warn("failed to build property summary", "property_id", property.ID, "error", err)
			continue
		}
		summaries = append(summaries, summary)
	}
	return summaries, nil
}

/**
 * Purpose:
 * Performs the buildSummary operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - buildSummary(ctx context.Context, property ingestiondomain.Property) (ingestiondomain.PropertySummary, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) buildSummary(ctx context.Context, property ingestiondomain.Property) (ingestiondomain.PropertySummary, error) {
	snapshots, err := s.store.GetLatestPropertySnapshots(ctx, property.ID, 2)
	if err != nil {
		return ingestiondomain.PropertySummary{}, err
	}
	var current, previous ingestiondomain.PropertySnapshot
	if len(snapshots) > 0 {
		current = snapshots[0]
	}
	if len(snapshots) > 1 {
		previous = snapshots[1]
	}
	config, _ := s.GetLatestPropertyConfig(ctx, property.ID)
	signals := ComputeChangeSignals(current, previous, property, config.Fields)
	decision := DeriveDecisionContext(property, current)
	currentValues := decodeSnapshotValues(current.Values)
	changeSummary := BuildLatestChangeSummary(signals)
	return ingestiondomain.PropertySummary{
		Property:            property,
		CurrentValues:       currentValues,
		Decision:            decision,
		Signals:             signals,
		LatestChangeSummary: changeSummary,
	}, nil
}

/**
 * Purpose:
 * Performs the DeleteRun operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - DeleteRun(ctx context.Context, runID string) error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) DeleteRun(ctx context.Context, runID string) error {
	err := s.store.DeletePropertySnapshot(ctx, runID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrPropertyRunNotFound
	}

	return err
}

/**
 * Purpose:
 * Performs the PreviewExtraction operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - PreviewExtraction(ctx context.Context, req ingestiondomain.PropertyPreviewRequest) (ingestiondomain.PropertyPreviewResult, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

/**
 * Purpose:
 * Performs the IngestProperty operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - IngestProperty(ctx context.Context, propertyID string) (ingestiondomain.PropertySnapshot, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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
	if err := s.store.UpsertPropertyFieldValues(ctx, snapshot, config.Fields); err != nil {
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

/**
 * Purpose:
 * Performs the IngestPropertyOnce operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - IngestPropertyOnce(ctx context.Context, propertyID string, attemptNum int, runID string) (ingestiondomain.PropertySnapshot, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) IngestPropertyOnce(ctx context.Context, propertyID string, attemptNum int, runID string) (ingestiondomain.PropertySnapshot, error) {
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
		_ = s.store.UpdatePropertyRunState(ctx, propertyID, ingestiondomain.PropertyStatusDegraded, &now, property.NextRunAt)

		return snapshot, fetchErr
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
	if err := s.store.UpsertPropertyFieldValues(ctx, snapshot, config.Fields); err != nil {
		return ingestiondomain.PropertySnapshot{}, err
	}

	if err := s.store.UpdatePropertyRunState(ctx, propertyID, status, &now, property.NextRunAt); err != nil {
		return ingestiondomain.PropertySnapshot{}, err
	}

	if s.changes != nil {
		if _, err := s.changes.ProcessPropertyRun(ctx, propertyID, snapshot, lastValid); err != nil {
			return ingestiondomain.PropertySnapshot{}, err
		}
	}

	if s.logger != nil {
		s.logger.Info("property ingest attempt completed",
			"property_id", propertyID,
			"attempt", attemptNum,
			"run_id", runID,
			"is_valid", isValid,
			"status", string(status),
		)
	}

	return snapshot, nil
}

/**
 * Purpose:
 * Performs the normalizeAndValidateProperty operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - normalizeAndValidateProperty(ctx context.Context, property ingestiondomain.Property) (ingestiondomain.Property, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) normalizeAndValidateProperty(ctx context.Context, property ingestiondomain.Property) (ingestiondomain.Property, error) {
	trimmedURL := strings.TrimSpace(property.URL)
	if trimmedURL != "" {
		if err := validatePropertyURL(trimmedURL); err != nil {
			return ingestiondomain.Property{}, err
		}
	}
	property.URL = trimmedURL
	if trimmedURL == "" && strings.TrimSpace(property.Label) == "" {
		property.Label = "Manual property"
	}
	normalizedHeaders, err := normalizePropertyRequestHeaders(property.RequestHeaders)
	if err != nil {
		return ingestiondomain.Property{}, err
	}
	property.RequestHeaders = normalizedHeaders
	property.SourceID = strings.TrimSpace(property.SourceID)
	property.PauseReason = strings.TrimSpace(property.PauseReason)
	property.Metadata.PriorityLevel = strings.TrimSpace(property.Metadata.PriorityLevel)
	property.Metadata.BusinessStage = strings.TrimSpace(property.Metadata.BusinessStage)
	property.Metadata.TrackingMode = strings.TrimSpace(property.Metadata.TrackingMode)
	property.Metadata.AcquisitionNotes = strings.TrimSpace(property.Metadata.AcquisitionNotes)
	property.Metadata.DealThesis = strings.TrimSpace(property.Metadata.DealThesis)
	for index := range property.Metadata.ExternalReferences {
		property.Metadata.ExternalReferences[index].Label = strings.TrimSpace(property.Metadata.ExternalReferences[index].Label)
		property.Metadata.ExternalReferences[index].Value = strings.TrimSpace(property.Metadata.ExternalReferences[index].Value)
	}
	for index := range property.Metadata.Attachments {
		property.Metadata.Attachments[index].Label = strings.TrimSpace(property.Metadata.Attachments[index].Label)
		property.Metadata.Attachments[index].URL = strings.TrimSpace(property.Metadata.Attachments[index].URL)
	}
	if property.SourceID != "" {
		if _, err := s.store.GetSource(ctx, property.SourceID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ingestiondomain.Property{}, fmt.Errorf("source not found")
			}
			return ingestiondomain.Property{}, err
		}
	}

	now := s.clock.Now().UTC()
	var existing *ingestiondomain.Property
	if strings.TrimSpace(property.ID) != "" {
		current, err := s.store.GetProperty(ctx, property.ID)
		switch {
		case err == nil:
			existing = &current
		case !errors.Is(err, sql.ErrNoRows):
			return ingestiondomain.Property{}, err
		}
	}
	if property.ID == "" {
		property.ID = id.New("prop")
	}
	if property.Status == "" && existing != nil {
		property.Status = existing.Status
	}
	if property.Status == "" {
		property.Status = ingestiondomain.PropertyStatusPending
	}
	if property.ScheduleIntervalSeconds <= 0 {
		property.ScheduleIntervalSeconds = int((time.Hour).Seconds())
	}
	if property.RetryMaxAttempts <= 0 {
		property.RetryMaxAttempts = 1
	}
	if property.RetryBackoffMillis <= 0 {
		property.RetryBackoffMillis = 500
	}
	if existing != nil {
		property.CreatedAt = existing.CreatedAt
		property.LastRunAt = existing.LastRunAt
		property.NextRunAt = reschedulePropertyRunAt(now, *existing, property.ScheduleInterval())
	} else {
		property.NextRunAt = nextPropertyRunAt(now, property.ScheduleInterval())
	}
	property.UpdatedAt = now
	if property.CreatedAt.IsZero() {
		property.CreatedAt = now
	}

	return property, nil
}

/**
 * Purpose:
 * Performs the recordManualSnapshot operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - recordManualSnapshot( ctx context.Context, property ingestiondomain.Property, manualValues map[string]string, ) (ingestiondomain.PropertySnapshot, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) recordManualSnapshot(
	ctx context.Context,
	property ingestiondomain.Property,
	manualValues map[string]string,
) (ingestiondomain.PropertySnapshot, error) {
	now := s.clock.Now().UTC()
	previous, err := s.store.GetLastValidPropertySnapshot(ctx, property.ID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.PropertySnapshot{}, err
	}

	values := decodeSnapshotValues(previous.Values)
	if values == nil {
		values = map[string]string{}
	}
	for key, value := range manualValues {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		values[key] = trimmed
	}
	if len(values) == 0 {
		return ingestiondomain.PropertySnapshot{}, fmt.Errorf("manual snapshot values are required")
	}

	changeFlags := map[string]bool{}
	previousValues := decodeSnapshotValues(previous.Values)
	for key, value := range values {
		if previousValues[key] != value {
			changeFlags[key] = true
		}
	}

	valuesJSON, _ := json.Marshal(values)
	changeFlagsJSON, _ := json.Marshal(changeFlags)
	snapshot := ingestiondomain.PropertySnapshot{
		ID:            id.New("run"),
		PropertyID:    property.ID,
		ConfigVersion: max(readManualConfigVersion(ctx, s.store, property.ID), 1),
		ObservedAt:    now,
		Values:        json.RawMessage(valuesJSON),
		ChangeFlags:   json.RawMessage(changeFlagsJSON),
		IsValid:       true,
	}

	if err := s.store.CreatePropertySnapshot(ctx, snapshot); err != nil {
		return ingestiondomain.PropertySnapshot{}, err
	}
	if err := s.store.UpsertPropertyFieldValues(ctx, snapshot, buildManualFieldSelectors(values)); err != nil {
		return ingestiondomain.PropertySnapshot{}, err
	}

	nextRun := nextPropertyRunAt(now, property.ScheduleInterval())
	if err := s.store.UpdatePropertyRunState(ctx, property.ID, ingestiondomain.PropertyStatusActive, &now, nextRun); err != nil {
		return ingestiondomain.PropertySnapshot{}, err
	}
	if err := s.store.CreatePropertyRun(ctx, ingestiondomain.PropertyRun{
		ID:           id.New("prun"),
		PropertyID:   property.ID,
		Status:       ingestiondomain.PropertyRunStatusSuccess,
		TriggerKind:  ingestiondomain.TriggerKindManual,
		AttemptCount: 1,
		MaxAttempts:  1,
		StartedAt:    &now,
		FinishedAt:   &now,
		SnapshotID:   snapshot.ID,
		CreatedAt:    now,
	}); err != nil {
		return ingestiondomain.PropertySnapshot{}, err
	}

	if s.changes != nil {
		if _, err := s.changes.ProcessPropertyRun(ctx, property.ID, snapshot, previous); err != nil {
			return ingestiondomain.PropertySnapshot{}, err
		}
	}

	s.emit("property.run.completed", map[string]any{
		"property_id":  property.ID,
		"is_valid":     true,
		"change_count": len(changeFlags),
		"trigger_kind": ingestiondomain.TriggerKindManual,
	})

	return snapshot, nil
}

/**
 * Purpose:
 * Performs the buildManualFieldSelectors operation for this backend package.
 *
 * Parameters:
 * - values map[string]string
 *
 * Returns:
 * - []ingestiondomain.FieldSelector
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func buildManualFieldSelectors(values map[string]string) []ingestiondomain.FieldSelector {
	fields := make([]ingestiondomain.FieldSelector, 0, len(values))
	for key := range values {
		fields = append(fields, ingestiondomain.FieldSelector{
			FieldName: key,
			Name:      key,
			Required:  key == "price",
		})
	}
	return fields
}

/**
 * Purpose:
 * Performs the readManualConfigVersion operation for this backend package.
 *
 * Parameters:
 * - ctx context.Context, store PropertyStore, propertyID string
 *
 * Returns:
 * - int
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func readManualConfigVersion(ctx context.Context, store PropertyStore, propertyID string) int {
	config, err := store.GetLatestPropertyConfig(ctx, propertyID)
	if err != nil {
		return 1
	}

	return config.Version
}

/**
 * Purpose:
 * Performs the resolveFields operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - resolveFields(ctx context.Context, sourceID string, customFields []ingestiondomain.FieldSelector) ([]ingestiondomain.FieldSelector, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

/**
 * Purpose:
 * Performs the fieldsFromSource operation for this backend package.
 *
 * Parameters:
 * - source ingestiondomain.Source
 *
 * Returns:
 * - []ingestiondomain.FieldSelector
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

/**
 * Purpose:
 * Performs the decodeSnapshotValues operation for this backend package.
 *
 * Parameters:
 * - values json.RawMessage
 *
 * Returns:
 * - map[string]string
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

/**
 * Purpose:
 * Performs the emit operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - emit(eventType string, data any)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) emit(eventType string, data any) {
	if s.events != nil {
		s.events.Publish(eventType, data)
	}
}

/**
 * Purpose:
 * Performs the validatePropertyURL operation for this backend package.
 *
 * Parameters:
 * - rawURL string
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
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

/**
 * Purpose:
 * Performs the fetchHTML operation for this backend package.
 *
 * Parameters:
 * - s *PropertyService
 *
 * Returns:
 * - fetchHTML(ctx context.Context, targetURL string, options propertyFetchOptions) ([]byte, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *PropertyService) fetchHTML(ctx context.Context, targetURL string, options propertyFetchOptions) ([]byte, error) {
	parsed, err := url.Parse(strings.TrimSpace(targetURL))
	if err != nil {
		return nil, err
	}
	if err := validateFetchHost(parsed.Hostname()); err != nil {
		return nil, err
	}

	response, err := s.fetcher.Fetch(ctx, fetcher.Request{
		URL:                        parsed.String(),
		Accept:                     "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		DefaultContentType:         "text/html; charset=utf-8",
		BrowserEnabled:             options.BrowserEnabled,
		BrowserFallbackOnChallenge: true,
		Headers:                    options.RequestHeaders,
		SessionKey:                 parsed.Hostname(),
	})
	if err != nil {
		return nil, err
	}

	return response.Payload, nil
}

/**
 * Purpose:
 * Performs the normalizePropertyRequestHeaders operation for this backend package.
 *
 * Parameters:
 * - headers map[string]string
 *
 * Returns:
 * - (map[string]string, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

/**
 * Purpose:
 * Performs the validateFetchHost operation for this backend package.
 *
 * Parameters:
 * - host string
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
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

/**
 * Purpose:
 * Performs the applySelectors operation for this backend package.
 *
 * Parameters:
 * - body []byte, fields []ingestiondomain.FieldSelector
 *
 * Returns:
 * - (map[string]string, []string, []ingestiondomain.PropertyPreviewFieldResult)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

/**
 * Purpose:
 * Performs the selectFieldValue operation for this backend package.
 *
 * Parameters:
 * - document *goquery.Document, rootNode *html.Node, field ingestiondomain.FieldSelector
 *
 * Returns:
 * - ingestiondomain.PropertyPreviewFieldResult
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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
			if errors.Is(err, errUnsupportedSelectorType) {
				result.ErrorCode = ingestiondomain.PreviewErrorCodeUnsupportedType
			} else {
				result.ErrorCode = ingestiondomain.PreviewErrorCodeSelectorInvalid
			}
			continue
		}
		if len(nodes) == 0 {
			if result.ErrorCode == "" {
				result.ErrorCode = ingestiondomain.PreviewErrorCodeNoMatch
			}
			continue
		}
		result.MatchCount = len(nodes)

		value, ok := extractNodeValue(nodes[0], field)
		if !ok {
			result.Message = missingValueMessage(field)
			if field.ExtractionMode == ingestiondomain.ExtractionModeAttribute || field.SelectorType == ingestiondomain.SelectorTypeAttribute {
				result.ErrorCode = ingestiondomain.PreviewErrorCodeAttributeMissing
			} else {
				result.ErrorCode = ingestiondomain.PreviewErrorCodeEmptyValue
			}
			continue
		}

		transformed, transformErr := applyFieldExtractionOptions(value, field)
		if transformErr != nil {
			result.Message = transformErr.Error()
			result.ErrorCode = ingestiondomain.PreviewErrorCodeTransformFailed
			continue
		}
		value = transformed

		if value != "" {
			result.MatchedSelector = selector
			result.Message = "Ready"
			result.Success = true
			result.UsedFallback = index > 0
			result.Value = value
			result.ErrorCode = ingestiondomain.PreviewErrorCodeOK
			if len(nodes) > 1 {
				result.Message = fmt.Sprintf("%d matches found. Using the first result.", len(nodes))
			}
			return result
		}
		result.Message = "The matched element was empty."
		result.ErrorCode = ingestiondomain.PreviewErrorCodeEmptyValue
	}
	if field.UseDefaultWhenMissing && strings.TrimSpace(field.DefaultValue) != "" {
		result.Message = "Used default value"
		result.Success = true
		result.Value = strings.TrimSpace(field.DefaultValue)
		result.ErrorCode = ingestiondomain.PreviewErrorCodeOK
		return result
	}
	if result.Message == "" {
		result.Message = "No selector matched."
	}
	if result.ErrorCode == "" {
		result.ErrorCode = ingestiondomain.PreviewErrorCodeNoMatch
	}
	return result
}

var errUnsupportedSelectorType = errors.New("unsupported selector type")

/**
 * Purpose:
 * Performs the querySelectorNodes operation for this backend package.
 *
 * Parameters:
 * - document *goquery.Document, rootNode *html.Node, field ingestiondomain.FieldSelector, selector string
 *
 * Returns:
 * - ([]*html.Node, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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
		return nil, errUnsupportedSelectorType
	}
}

/**
 * Purpose:
 * Performs the extractNodeValue operation for this backend package.
 *
 * Parameters:
 * - node *html.Node, field ingestiondomain.FieldSelector
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
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

	var value string
	switch field.TextMode {
	case ingestiondomain.TextModeTextContent:
		value = nodeTextContent(node)
	default:
		// innerText (and the empty default) renders the way a human reads the page:
		// strip <script>/<style>, collapse whitespace.
		value = nodeInnerText(node)
	}
	value = strings.TrimSpace(value)
	return value, value != ""
}

/**
 * Purpose:
 * Performs the nodeTextContent operation for this backend package.
 *
 * Parameters:
 * - node *html.Node
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
 * - May read/write external state when invoked collaborators perform I/O.
 */
func nodeTextContent(node *html.Node) string {
	var builder strings.Builder
	var walk func(*html.Node)
	walk = func(current *html.Node) {
		if current == nil {
			return
		}
		if current.Type == html.TextNode {
			builder.WriteString(current.Data)
		}
		for child := current.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(node)
	return builder.String()
}

/**
 * Purpose:
 * Performs the nodeInnerText operation for this backend package.
 *
 * Parameters:
 * - node *html.Node
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
 * - May read/write external state when invoked collaborators perform I/O.
 */
func nodeInnerText(node *html.Node) string {
	var builder strings.Builder
	var walk func(*html.Node)
	walk = func(current *html.Node) {
		if current == nil {
			return
		}
		if current.Type == html.ElementNode {
			switch strings.ToLower(current.Data) {
			case "script", "style", "template", "noscript":
				return
			}
		}
		if current.Type == html.TextNode {
			builder.WriteString(current.Data)
		}
		for child := current.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(node)
	return collapseWhitespace(builder.String())
}

/**
 * Purpose:
 * Performs the collapseWhitespace operation for this backend package.
 *
 * Parameters:
 * - value string
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
 * - May read/write external state when invoked collaborators perform I/O.
 */
func collapseWhitespace(value string) string {
	var builder strings.Builder
	builder.Grow(len(value))
	prevSpace := true
	for _, r := range value {
		if r == ' ' || r == '\t' || r == '\n' || r == '\r' || r == '\u00a0' {
			if !prevSpace {
				builder.WriteByte(' ')
				prevSpace = true
			}
			continue
		}
		builder.WriteRune(r)
		prevSpace = false
	}
	return strings.TrimSpace(builder.String())
}

/**
 * Purpose:
 * Performs the missingValueMessage operation for this backend package.
 *
 * Parameters:
 * - field ingestiondomain.FieldSelector
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
 * - May read/write external state when invoked collaborators perform I/O.
 */
func missingValueMessage(field ingestiondomain.FieldSelector) string {
	if field.ExtractionMode == ingestiondomain.ExtractionModeAttribute || field.SelectorType == ingestiondomain.SelectorTypeAttribute {
		return fmt.Sprintf("Attribute %q was not found.", field.Attribute)
	}
	return "The matched element was empty."
}

/**
 * Purpose:
 * Performs the resolveSelectorStrategy operation for this backend package.
 *
 * Parameters:
 * - selectorType ingestiondomain.SelectorType
 *
 * Returns:
 * - ingestiondomain.SelectorType
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

/**
 * Purpose:
 * Performs the normalizeConfiguredFields operation for this backend package.
 *
 * Parameters:
 * - fields []ingestiondomain.FieldSelector
 *
 * Returns:
 * - ([]ingestiondomain.FieldSelector, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func normalizeConfiguredFields(fields []ingestiondomain.FieldSelector) ([]ingestiondomain.FieldSelector, error) {
	if len(fields) == 0 {
		return nil, fmt.Errorf("at least one field is required")
	}

	normalized := make([]ingestiondomain.FieldSelector, 0, len(fields))
	names := make(map[string]struct{}, len(fields))
	for _, field := range fields {
		field.Name = strings.TrimSpace(field.Name)
		field.FieldName = strings.TrimSpace(field.FieldName)
		field.SelectorValue = strings.TrimSpace(field.SelectorValue)
		field.Attribute = strings.TrimSpace(field.Attribute)
		field.Transform = strings.TrimSpace(field.Transform)
		field.DefaultValue = strings.TrimSpace(field.DefaultValue)
		field.RegexPattern = strings.TrimSpace(field.RegexPattern)
		field.SplitDelimiter = strings.TrimSpace(field.SplitDelimiter)
		field.PartialMatch = strings.TrimSpace(field.PartialMatch)
		field.ComparisonOperator = strings.TrimSpace(strings.ToLower(field.ComparisonOperator))
		field.ComparisonValue = strings.TrimSpace(field.ComparisonValue)
		field.FieldRole = ingestiondomain.NormalizeFieldRole(field.FieldRole, field.Name)
		field.FallbackSelectors = ingestiondomain.NormalizeSelectorList(field.FallbackSelectors)
		if strings.EqualFold(field.Name, "price") {
			field.Required = true
		}

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
		if _, ok := supportedTransforms[strings.TrimSpace(strings.ToLower(field.Transform))]; !ok {
			return nil, fmt.Errorf("field %q uses unknown transform %q", field.Name, field.Transform)
		}
		if field.RegexPattern != "" {
			if _, err := regexp.Compile(field.RegexPattern); err != nil {
				return nil, fmt.Errorf("field %q has invalid regex", field.Name)
			}
		}
		if field.ComparisonOperator != "" {
			switch field.ComparisonOperator {
			case "eq", "gt", "lt", "contains":
			default:
				return nil, fmt.Errorf("field %q uses unknown comparison operator", field.Name)
			}
			if field.ComparisonValue == "" {
				return nil, fmt.Errorf("field %q comparison needs a value", field.Name)
			}
		}
		normalized = append(normalized, field)
	}

	return normalized, nil
}

/**
 * Purpose:
 * Performs the validateXPathSelector operation for this backend package.
 *
 * Parameters:
 * - selector string
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
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

/**
 * Purpose:
 * Performs the applyFieldExtractionOptions operation for this backend package.
 *
 * Parameters:
 * - value string, field ingestiondomain.FieldSelector
 *
 * Returns:
 * - (string, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func applyFieldExtractionOptions(value string, field ingestiondomain.FieldSelector) (string, error) {
	value = strings.TrimSpace(value)
	if field.RegexPattern != "" {
		expression, err := regexp.Compile(field.RegexPattern)
		if err != nil {
			return "", fmt.Errorf("invalid regex extraction")
		}
		match := expression.FindStringSubmatch(value)
		if len(match) == 0 {
			return "", fmt.Errorf("regex extraction found no match")
		}
		if len(match) > 1 {
			value = match[1]
		} else {
			value = match[0]
		}
	}
	if field.PartialMatch != "" {
		if index := strings.Index(strings.ToLower(value), strings.ToLower(field.PartialMatch)); index >= 0 {
			value = value[index : index+len(field.PartialMatch)]
		} else {
			return "", fmt.Errorf("partial match was not found")
		}
	}
	if field.SplitDelimiter != "" {
		parts := strings.Split(value, field.SplitDelimiter)
		trimmed := make([]string, 0, len(parts))
		for _, part := range parts {
			part = strings.TrimSpace(part)
			if part != "" {
				trimmed = append(trimmed, part)
			}
		}
		if len(trimmed) == 0 {
			return "", fmt.Errorf("split extraction found no values")
		}
		if field.MultiValue {
			value = strings.Join(trimmed, ", ")
		} else {
			value = trimmed[0]
		}
	}
	transformed, err := applyTransform(value, field.Transform)
	if err != nil {
		return "", err
	}
	if field.ComparisonOperator != "" {
		return fmt.Sprintf("%t", compareFieldValue(transformed, field.ComparisonOperator, field.ComparisonValue)), nil
	}
	return transformed, nil
}

/**
 * Purpose:
 * Performs the compareFieldValue operation for this backend package.
 *
 * Parameters:
 * - value, operator, expected string
 *
 * Returns:
 * - bool
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func compareFieldValue(value, operator, expected string) bool {
	switch operator {
	case "contains":
		return strings.Contains(strings.ToLower(value), strings.ToLower(expected))
	case "gt", "lt":
		left := ingestiondomain.ParseLooseFloat(value)
		right := ingestiondomain.ParseLooseFloat(expected)
		if operator == "gt" {
			return left > right
		}
		return left < right
	case "eq":
		return strings.EqualFold(strings.TrimSpace(value), strings.TrimSpace(expected))
	default:
		return false
	}
}

// supportedTransforms enumerates the transform identifiers recognised by the
// extraction engine. Adding a new transform requires updating both this map and
// applyTransform.
var supportedTransforms = map[string]struct{}{
	"":          {}, // no-op
	"trim":      {},
	"lowercase": {},
	"uppercase": {},
	"number":    {}, // historical alias for "integer"
	"integer":   {},
	"decimal":   {},
	"currency":  {},
}

/**
 * Purpose:
 * Performs the applyTransform operation for this backend package.
 *
 * Parameters:
 * - value, transform string
 *
 * Returns:
 * - (string, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func applyTransform(value, transform string) (string, error) {
	key := strings.TrimSpace(strings.ToLower(transform))
	if _, ok := supportedTransforms[key]; !ok {
		return "", fmt.Errorf("unknown transform %q", transform)
	}
	switch key {
	case "", "trim":
		return strings.TrimSpace(value), nil
	case "lowercase":
		return strings.ToLower(strings.TrimSpace(value)), nil
	case "uppercase":
		return strings.ToUpper(strings.TrimSpace(value)), nil
	case "number", "integer":
		return normalizeIntegerString(value), nil
	case "decimal", "currency":
		return normalizeDecimalString(value), nil
	}
	return value, nil
}

/**
 * Purpose:
 * Performs the normalizeIntegerString operation for this backend package.
 *
 * Parameters:
 * - value string
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
 * - May read/write external state when invoked collaborators perform I/O.
 */
func normalizeIntegerString(value string) string {
	var digits strings.Builder
	for _, char := range value {
		if char >= '0' && char <= '9' {
			digits.WriteRune(char)
		}
	}
	return digits.String()
}

/**
 * Purpose:
 * Performs the normalizeDecimalString operation for this backend package.
 *
 * Parameters:
 * - value string
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
 * - May read/write external state when invoked collaborators perform I/O.
 */
func normalizeDecimalString(value string) string {
	negative := strings.Contains(value, "-")

	// Step 1: keep only digits, '.', ','.
	var stripped strings.Builder
	for _, r := range value {
		if r >= '0' && r <= '9' || r == '.' || r == ',' {
			stripped.WriteRune(r)
		}
	}
	cleaned := stripped.String()
	if cleaned == "" {
		return ""
	}

	// Step 2: locate the right-most separator and decide whether it is a decimal point.
	lastSep := strings.LastIndexAny(cleaned, ".,")
	useDecimal := false
	if lastSep != -1 {
		trailing := cleaned[lastSep+1:]
		if len(trailing) >= 1 && len(trailing) <= 2 {
			useDecimal = true
		}
	}

	// Step 3: emit digits, replacing the chosen separator (if any) with '.' and
	// dropping every other separator.
	var out strings.Builder
	for i := 0; i < len(cleaned); i++ {
		ch := cleaned[i]
		if ch >= '0' && ch <= '9' {
			out.WriteByte(ch)
			continue
		}
		if useDecimal && i == lastSep {
			out.WriteByte('.')
		}
	}
	result := out.String()
	if result == "" || result == "." {
		return ""
	}
	if negative {
		result = "-" + result
	}
	return result
}

/**
 * Purpose:
 * Performs the nextPropertyRunAt operation for this backend package.
 *
 * Parameters:
 * - now time.Time, interval time.Duration
 *
 * Returns:
 * - *time.Time
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func nextPropertyRunAt(now time.Time, interval time.Duration) *time.Time {
	if interval <= 0 {
		return nil
	}
	nextRun := now.Add(interval)
	return &nextRun
}

/**
 * Purpose:
 * Performs the reschedulePropertyRunAt operation for this backend package.
 *
 * Parameters:
 * - now time.Time, existing ingestiondomain.Property, interval time.Duration
 *
 * Returns:
 * - *time.Time
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func reschedulePropertyRunAt(now time.Time, existing ingestiondomain.Property, interval time.Duration) *time.Time {
	if interval <= 0 {
		return nil
	}
	if existing.ScheduleInterval() == interval && existing.NextRunAt != nil {
		preserved := existing.NextRunAt.UTC()
		return &preserved
	}
	if existing.LastRunAt != nil {
		nextRun := existing.LastRunAt.Add(interval)
		if nextRun.After(now) {
			return &nextRun
		}
		immediate := now
		return &immediate
	}
	return nextPropertyRunAt(now, interval)
}

/**
 * Purpose:
 * Performs the max operation for this backend package.
 *
 * Parameters:
 * - a, b int
 *
 * Returns:
 * - int
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
