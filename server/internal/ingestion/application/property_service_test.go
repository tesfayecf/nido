/**
 * File: internal/ingestion/application/property_service_test.go
 *
 * Purpose:
 * Validates the application package behavior covered by property_service_test.go.
 *
 * Responsibilities:
 * - Set up deterministic test fixtures
 * - Exercise expected success and failure paths
 * - Protect backend behavior from regressions
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - context
 * - database/sql
 * - encoding/json
 * - errors
 * - strings
 * - testing
 * - time
 * - nido/server/internal/engine
 * - nido/server/internal/fetcher
 * - nido/server/internal/ingestion/domain
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package application

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"nido/server/internal/engine"
	"nido/server/internal/fetcher"
	ingestiondomain "nido/server/internal/ingestion/domain"
)

/**
 * Purpose:
 * Defines the stubFetchClient struct used by this package and its consumers.
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
type stubFetchClient struct {
	requests []fetcher.Request
	response fetcher.Response
	err      error
}

/**
 * Purpose:
 * Defines the propertyServiceStoreStub struct used by this package and its consumers.
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
type propertyServiceStoreStub struct {
	property            ingestiondomain.Property
	propertyErr         error
	config              ingestiondomain.PropertyExtractionConfig
	propertyRuns        []ingestiondomain.PropertyRun
	upserted            ingestiondomain.Property
	updateRunStateCalls []updateRunStateCall
	snapshots           []ingestiondomain.PropertySnapshot
}

/**
 * Purpose:
 * Performs the Fetch operation for this backend package.
 *
 * Parameters:
 * - client *stubFetchClient
 *
 * Returns:
 * - Fetch(_ context.Context, request fetcher.Request) (fetcher.Response, error)
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
func (client *stubFetchClient) Fetch(_ context.Context, request fetcher.Request) (fetcher.Response, error) {
	client.requests = append(client.requests, request)
	return client.response, client.err
}

/**
 * Purpose:
 * Performs the UpsertProperty operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - UpsertProperty(_ context.Context, property ingestiondomain.Property) error
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
func (s *propertyServiceStoreStub) UpsertProperty(_ context.Context, property ingestiondomain.Property) error {
	s.property = property
	s.upserted = property
	return nil
}

/**
 * Purpose:
 * Performs the ListProperties operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - ListProperties(context.Context) ([]ingestiondomain.Property, error)
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
func (s *propertyServiceStoreStub) ListProperties(context.Context) ([]ingestiondomain.Property, error) {
	return nil, nil
}

/**
 * Purpose:
 * Performs the GetProperty operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - GetProperty(context.Context, string) (ingestiondomain.Property, error)
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
func (s *propertyServiceStoreStub) GetProperty(context.Context, string) (ingestiondomain.Property, error) {
	if s.property.ID != "" {
		return s.property, nil
	}
	if s.propertyErr != nil {
		return ingestiondomain.Property{}, s.propertyErr
	}
	return s.property, nil
}

/**
 * Purpose:
 * Performs the DeleteProperty operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - DeleteProperty(context.Context, string) error
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
func (s *propertyServiceStoreStub) DeleteProperty(context.Context, string) error {
	return nil
}

/**
 * Purpose:
 * Performs the UpdatePropertyRunState operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - UpdatePropertyRunState(_ context.Context, propertyID string, status ingestiondomain.PropertyStatus, lastRunAt, nextRunAt *time.Time) error
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
func (s *propertyServiceStoreStub) UpdatePropertyRunState(_ context.Context, propertyID string, status ingestiondomain.PropertyStatus, lastRunAt, nextRunAt *time.Time) error {
	s.updateRunStateCalls = append(s.updateRunStateCalls, updateRunStateCall{
		propertyID: propertyID,
		status:     status,
		lastRunAt:  lastRunAt,
		nextRunAt:  nextRunAt,
	})
	s.property.Status = status
	s.property.LastRunAt = lastRunAt
	s.property.NextRunAt = nextRunAt
	return nil
}

/**
 * Purpose:
 * Performs the CreatePropertyRun operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - CreatePropertyRun(_ context.Context, run ingestiondomain.PropertyRun) error
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
func (s *propertyServiceStoreStub) CreatePropertyRun(_ context.Context, run ingestiondomain.PropertyRun) error {
	s.propertyRuns = append(s.propertyRuns, run)
	return nil
}

/**
 * Purpose:
 * Performs the UpsertPropertyConfig operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - UpsertPropertyConfig(context.Context, ingestiondomain.PropertyExtractionConfig) error
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
func (s *propertyServiceStoreStub) UpsertPropertyConfig(context.Context, ingestiondomain.PropertyExtractionConfig) error {
	return nil
}

/**
 * Purpose:
 * Performs the GetLatestPropertyConfig operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - GetLatestPropertyConfig(context.Context, string) (ingestiondomain.PropertyExtractionConfig, error)
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
func (s *propertyServiceStoreStub) GetLatestPropertyConfig(context.Context, string) (ingestiondomain.PropertyExtractionConfig, error) {
	return s.config, nil
}

/**
 * Purpose:
 * Performs the ListPropertyConfigs operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - ListPropertyConfigs(context.Context, string) ([]ingestiondomain.PropertyExtractionConfig, error)
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
func (s *propertyServiceStoreStub) ListPropertyConfigs(context.Context, string) ([]ingestiondomain.PropertyExtractionConfig, error) {
	return []ingestiondomain.PropertyExtractionConfig{s.config}, nil
}

/**
 * Purpose:
 * Performs the GetPropertyConfigVersion operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - GetPropertyConfigVersion(context.Context, string, int) (ingestiondomain.PropertyExtractionConfig, error)
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
func (s *propertyServiceStoreStub) GetPropertyConfigVersion(context.Context, string, int) (ingestiondomain.PropertyExtractionConfig, error) {
	return s.config, nil
}

/**
 * Purpose:
 * Performs the CreatePropertySnapshot operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - CreatePropertySnapshot(_ context.Context, snapshot ingestiondomain.PropertySnapshot) error
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
func (s *propertyServiceStoreStub) CreatePropertySnapshot(_ context.Context, snapshot ingestiondomain.PropertySnapshot) error {
	s.snapshots = append(s.snapshots, snapshot)
	return nil
}

/**
 * Purpose:
 * Performs the UpsertPropertyFieldValues operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - UpsertPropertyFieldValues(context.Context, ingestiondomain.PropertySnapshot, []ingestiondomain.FieldSelector) error
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
func (s *propertyServiceStoreStub) UpsertPropertyFieldValues(context.Context, ingestiondomain.PropertySnapshot, []ingestiondomain.FieldSelector) error {
	return nil
}

/**
 * Purpose:
 * Performs the ListPropertySnapshots operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - ListPropertySnapshots(context.Context, string, int) ([]ingestiondomain.PropertySnapshot, error)
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
func (s *propertyServiceStoreStub) ListPropertySnapshots(context.Context, string, int) ([]ingestiondomain.PropertySnapshot, error) {
	return nil, nil
}

/**
 * Purpose:
 * Performs the ListAllPropertySnapshots operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - ListAllPropertySnapshots(context.Context, string, int) ([]ingestiondomain.PropertySnapshot, error)
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
func (s *propertyServiceStoreStub) ListAllPropertySnapshots(context.Context, string, int) ([]ingestiondomain.PropertySnapshot, error) {
	return nil, nil
}

/**
 * Purpose:
 * Performs the GetPropertySnapshot operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - GetPropertySnapshot(context.Context, string) (ingestiondomain.PropertySnapshot, error)
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
func (s *propertyServiceStoreStub) GetPropertySnapshot(context.Context, string) (ingestiondomain.PropertySnapshot, error) {
	return ingestiondomain.PropertySnapshot{}, nil
}

/**
 * Purpose:
 * Performs the DeletePropertySnapshot operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - DeletePropertySnapshot(context.Context, string) error
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
func (s *propertyServiceStoreStub) DeletePropertySnapshot(context.Context, string) error {
	return nil
}

/**
 * Purpose:
 * Performs the GetLastValidPropertySnapshot operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - GetLastValidPropertySnapshot(context.Context, string) (ingestiondomain.PropertySnapshot, error)
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
func (s *propertyServiceStoreStub) GetLastValidPropertySnapshot(context.Context, string) (ingestiondomain.PropertySnapshot, error) {
	for index := len(s.snapshots) - 1; index >= 0; index -= 1 {
		if s.snapshots[index].IsValid {
			return s.snapshots[index], nil
		}
	}
	return ingestiondomain.PropertySnapshot{}, sql.ErrNoRows
}

/**
 * Purpose:
 * Performs the GetSource operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - GetSource(context.Context, string) (ingestiondomain.Source, error)
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
func (s *propertyServiceStoreStub) GetSource(context.Context, string) (ingestiondomain.Source, error) {
	return ingestiondomain.Source{}, nil
}

/**
 * Purpose:
 * Performs the ListPropertiesByTagIDs operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - ListPropertiesByTagIDs(context.Context, []string, bool) ([]string, error)
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
func (s *propertyServiceStoreStub) ListPropertiesByTagIDs(context.Context, []string, bool) ([]string, error) {
	return nil, nil
}

/**
 * Purpose:
 * Performs the ListPropertyRuns operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - ListPropertyRuns(context.Context, string, int) ([]ingestiondomain.PropertyRun, error)
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
func (s *propertyServiceStoreStub) ListPropertyRuns(context.Context, string, int) ([]ingestiondomain.PropertyRun, error) {
	return nil, nil
}

/**
 * Purpose:
 * Performs the GetLatestPropertySnapshots operation for this backend package.
 *
 * Parameters:
 * - s *propertyServiceStoreStub
 *
 * Returns:
 * - GetLatestPropertySnapshots(_ context.Context, _ string, _ int) ([]ingestiondomain.PropertySnapshot, error)
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
func (s *propertyServiceStoreStub) GetLatestPropertySnapshots(_ context.Context, _ string, _ int) ([]ingestiondomain.PropertySnapshot, error) {
	return nil, nil
}

/**
 * Purpose:
 * Performs the TestApplySelectorsSupportsStructuredSelectors operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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

/**
 * Purpose:
 * Performs the TestApplySelectorsSupportsXPathSelectors operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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

/**
 * Purpose:
 * Performs the TestNormalizeConfiguredFieldsSupportsLegacySelectorShape operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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
	if fields[0].FieldRole != ingestiondomain.FieldRoleTracked || !fields[0].Required {
		t.Fatalf("expected price to be tracked and required, got role=%q required=%v", fields[0].FieldRole, fields[0].Required)
	}
}

/**
 * Purpose:
 * Performs the TestNormalizeConfiguredFieldsDefaultsListingFactsToPrefill operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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
func TestNormalizeConfiguredFieldsDefaultsListingFactsToPrefill(t *testing.T) {
	t.Parallel()

	fields, err := normalizeConfiguredFields([]ingestiondomain.FieldSelector{
		{
			Name:          "location",
			SelectorValue: ".location",
		},
	})
	if err != nil {
		t.Fatalf("expected field to normalize, got %v", err)
	}
	if fields[0].FieldRole != ingestiondomain.FieldRolePrefill {
		t.Fatalf("expected location to default to prefill, got %q", fields[0].FieldRole)
	}
}

/**
 * Purpose:
 * Performs the TestNormalizeConfiguredFieldsRejectsUnsupportedXPathSyntax operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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

/**
 * Purpose:
 * Performs the TestNormalizeConfiguredFieldsAcceptsAbsoluteXPathSelector operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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

/**
 * Purpose:
 * Performs the TestPreviewExtractionUsesSharedFetcher operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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

/**
 * Purpose:
 * Performs the TestPreviewExtractionForwardsBrowserAndRequestHeaders operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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

/**
 * Purpose:
 * Performs the TestPreviewExtractionRejectsUnsupportedRequestHeaders operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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

/**
 * Purpose:
 * Performs the TestPreviewExtractionRejectsAntiBotChallengePages operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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

/**
 * Purpose:
 * Performs the TestEnsurePropertySchedulesNewPropertyFromConfiguredInterval operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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
func TestEnsurePropertySchedulesNewPropertyFromConfiguredInterval(t *testing.T) {
	t.Parallel()

	now := time.Date(2024, time.January, 1, 12, 0, 0, 0, time.UTC)
	store := &propertyServiceStoreStub{propertyErr: sql.ErrNoRows}
	service := NewPropertyService(nil, store, nil, fixedClock{now: now}, nil, nil)

	property, err := service.EnsureProperty(context.Background(), ingestiondomain.Property{
		Label:                   "Tracked listing",
		ScheduleIntervalSeconds: 300,
		URL:                     "https://example.com/listing",
	})
	if err != nil {
		t.Fatalf("expected property to save, got %v", err)
	}

	if property.NextRunAt == nil {
		t.Fatal("expected next run to be computed")
	}
	expectedNextRun := now.Add(5 * time.Minute)
	if !property.NextRunAt.Equal(expectedNextRun) {
		t.Fatalf("expected next run %v, got %v", expectedNextRun, *property.NextRunAt)
	}
}

/**
 * Purpose:
 * Performs the TestEnsurePropertyReschedulesExistingPropertyWithoutResettingRunState operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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
func TestEnsurePropertyReschedulesExistingPropertyWithoutResettingRunState(t *testing.T) {
	t.Parallel()

	now := time.Date(2024, time.January, 1, 12, 0, 30, 0, time.UTC)
	lastRun := now.Add(-30 * time.Second)
	nextRun := now.Add(30 * time.Second)
	store := &propertyServiceStoreStub{
		property: ingestiondomain.Property{
			ID:                      "prop_1",
			Label:                   "Tracked listing",
			LastRunAt:               &lastRun,
			NextRunAt:               &nextRun,
			RetryBackoffMillis:      500,
			RetryMaxAttempts:        2,
			ScheduleIntervalSeconds: 60,
			Status:                  ingestiondomain.PropertyStatusActive,
			URL:                     "https://example.com/listing",
			CreatedAt:               now.Add(-2 * time.Hour),
		},
	}
	service := NewPropertyService(nil, store, nil, fixedClock{now: now}, nil, nil)

	property, err := service.EnsureProperty(context.Background(), ingestiondomain.Property{
		ID:                      "prop_1",
		Label:                   "Tracked listing",
		RetryBackoffMillis:      1_000,
		RetryMaxAttempts:        4,
		ScheduleIntervalSeconds: 3600,
		URL:                     "https://example.com/listing",
	})
	if err != nil {
		t.Fatalf("expected property update to succeed, got %v", err)
	}

	if property.Status != ingestiondomain.PropertyStatusActive {
		t.Fatalf("expected existing status to be preserved, got %q", property.Status)
	}
	if property.LastRunAt == nil || !property.LastRunAt.Equal(lastRun) {
		t.Fatalf("expected last run to be preserved, got %v", property.LastRunAt)
	}
	if property.NextRunAt == nil {
		t.Fatal("expected rescheduled next run to be computed")
	}
	expectedNextRun := lastRun.Add(1 * time.Hour)
	if !property.NextRunAt.Equal(expectedNextRun) {
		t.Fatalf("expected next run %v, got %v", expectedNextRun, *property.NextRunAt)
	}
}

/**
 * Purpose:
 * Performs the TestUpsertPropertyWithManualDataSkipsSnapshotWithoutManualValues operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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
func TestUpsertPropertyWithManualDataSkipsSnapshotWithoutManualValues(t *testing.T) {
	t.Parallel()

	now := time.Date(2024, time.January, 2, 9, 0, 0, 0, time.UTC)
	store := &propertyServiceStoreStub{propertyErr: sql.ErrNoRows}
	service := NewPropertyService(nil, store, nil, fixedClock{now: now}, nil, nil)

	property, err := service.UpsertPropertyWithManualData(context.Background(), ingestiondomain.Property{
		Label: "Automated listing",
		URL:   "https://example.com/listing",
	}, map[string]string{})
	if err != nil {
		t.Fatalf("expected save without manual values to succeed, got %v", err)
	}
	if property.ID == "" {
		t.Fatal("expected property to be saved")
	}
	if len(store.snapshots) != 0 {
		t.Fatalf("expected no manual snapshots, got %d", len(store.snapshots))
	}
}

/**
 * Purpose:
 * Performs the TestUpsertPropertyWithManualDataCreatesSnapshotAndRun operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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
func TestUpsertPropertyWithManualDataCreatesSnapshotAndRun(t *testing.T) {
	t.Parallel()

	now := time.Date(2024, time.January, 2, 9, 30, 0, 0, time.UTC)
	store := &propertyServiceStoreStub{
		propertyErr: sql.ErrNoRows,
		config: ingestiondomain.PropertyExtractionConfig{
			PropertyID: "prop_1",
			Version:    3,
		},
	}
	service := NewPropertyService(nil, store, nil, fixedClock{now: now}, nil, nil)

	property, err := service.UpsertPropertyWithManualData(context.Background(), ingestiondomain.Property{
		Label: "Manual listing",
	}, map[string]string{
		"area_m2":   "88",
		"bathrooms": "2",
		"price":     "320000",
		"rooms":     "4",
	})
	if err != nil {
		t.Fatalf("expected manual save to succeed, got %v", err)
	}

	if property.Status != ingestiondomain.PropertyStatusActive {
		t.Fatalf("expected active status, got %q", property.Status)
	}
	if property.LastRunAt == nil || !property.LastRunAt.Equal(now) {
		t.Fatalf("expected last run at %v, got %v", now, property.LastRunAt)
	}
	if len(store.snapshots) != 1 {
		t.Fatalf("expected one snapshot, got %d", len(store.snapshots))
	}
	if len(store.propertyRuns) != 1 {
		t.Fatalf("expected one property run, got %d", len(store.propertyRuns))
	}

	values := decodeSnapshotValues(store.snapshots[0].Values)
	if values["price"] != "320000" || values["area_m2"] != "88" {
		t.Fatalf("expected manual values to be persisted, got %+v", values)
	}
	if store.propertyRuns[0].TriggerKind != ingestiondomain.TriggerKindManual {
		t.Fatalf("expected manual run trigger, got %q", store.propertyRuns[0].TriggerKind)
	}
	if store.propertyRuns[0].SnapshotID != store.snapshots[0].ID {
		t.Fatalf("expected run snapshot id %q, got %q", store.snapshots[0].ID, store.propertyRuns[0].SnapshotID)
	}
}

/**
 * Purpose:
 * Performs the TestUpsertPropertyWithManualDataAppendsToExistingSnapshotValues operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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
func TestUpsertPropertyWithManualDataAppendsToExistingSnapshotValues(t *testing.T) {
	t.Parallel()

	now := time.Date(2024, time.January, 2, 10, 0, 0, 0, time.UTC)
	lastRun := now.Add(-2 * time.Hour)
	store := &propertyServiceStoreStub{
		property: ingestiondomain.Property{
			ID:                      "prop_1",
			Label:                   "Manual listing",
			LastRunAt:               &lastRun,
			RetryBackoffMillis:      500,
			RetryMaxAttempts:        1,
			ScheduleIntervalSeconds: 0,
			Status:                  ingestiondomain.PropertyStatusActive,
		},
		snapshots: []ingestiondomain.PropertySnapshot{
			{
				ID:         "run_prev",
				PropertyID: "prop_1",
				ObservedAt: now.Add(-24 * time.Hour),
				Values:     []byte(`{"price":"300000","rooms":"3"}`),
				IsValid:    true,
			},
		},
	}
	service := NewPropertyService(nil, store, nil, fixedClock{now: now}, nil, nil)

	_, err := service.UpsertPropertyWithManualData(context.Background(), ingestiondomain.Property{
		ID:    "prop_1",
		Label: "Manual listing",
	}, map[string]string{
		"bathrooms": "2",
		"price":     "295000",
	})
	if err != nil {
		t.Fatalf("expected manual update to succeed, got %v", err)
	}

	if len(store.snapshots) != 2 {
		t.Fatalf("expected appended snapshot, got %d snapshots", len(store.snapshots))
	}
	latest := store.snapshots[len(store.snapshots)-1]
	values := decodeSnapshotValues(latest.Values)
	changeFlags := map[string]bool{}
	if err := json.Unmarshal(latest.ChangeFlags, &changeFlags); err != nil {
		t.Fatalf("expected change flags json, got %v", err)
	}
	if values["rooms"] != "3" || values["bathrooms"] != "2" || values["price"] != "295000" {
		t.Fatalf("expected merged manual values, got %+v", values)
	}
	if !changeFlags["price"] || !changeFlags["bathrooms"] {
		t.Fatalf("expected manual changes to be flagged, got %+v", changeFlags)
	}
}

/**
 * Purpose:
 * Performs the TestIngestPropertyOncePreservesReservedNextRunAt operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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
func TestIngestPropertyOncePreservesReservedNextRunAt(t *testing.T) {
	t.Parallel()

	now := time.Date(2024, time.January, 1, 12, 0, 0, 0, time.UTC)
	nextRun := now.Add(10 * time.Minute)
	store := &propertyServiceStoreStub{
		property: ingestiondomain.Property{
			ID:                      "prop_1",
			Label:                   "Tracked listing",
			NextRunAt:               &nextRun,
			RetryMaxAttempts:        2,
			RetryBackoffMillis:      500,
			ScheduleIntervalSeconds: 600,
			Status:                  ingestiondomain.PropertyStatusPending,
			URL:                     "https://example.com/listing",
		},
		config: ingestiondomain.PropertyExtractionConfig{
			PropertyID: "prop_1",
			Version:    1,
			Fields: []ingestiondomain.FieldSelector{
				{
					Name:           "title",
					SelectorType:   ingestiondomain.SelectorTypeCSS,
					SelectorValue:  ".title",
					ExtractionMode: ingestiondomain.ExtractionModeText,
					Required:       true,
				},
			},
		},
	}
	service := NewPropertyService(nil, store, &stubFetchClient{
		response: fetcher.Response{
			Payload:   []byte(`<html><body><h1 class="title">Sunny flat</h1></body></html>`),
			FetchedAt: now,
		},
	}, fixedClock{now: now}, nil, nil)

	if _, err := service.IngestPropertyOnce(context.Background(), "prop_1", 1, "run_1"); err != nil {
		t.Fatalf("expected scheduled ingest to succeed, got %v", err)
	}

	if len(store.updateRunStateCalls) == 0 {
		t.Fatal("expected property run state to be updated")
	}
	lastCall := store.updateRunStateCalls[len(store.updateRunStateCalls)-1]
	if lastCall.nextRunAt == nil {
		t.Fatal("expected reserved next run timestamp to be preserved")
	}
	if !lastCall.nextRunAt.Equal(nextRun) {
		t.Fatalf("expected next run %v, got %v", nextRun, *lastCall.nextRunAt)
	}
}
