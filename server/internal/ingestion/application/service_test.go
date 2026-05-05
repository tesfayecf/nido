/**
 * File: internal/ingestion/application/service_test.go
 *
 * Purpose:
 * Validates the application package behavior covered by service_test.go.
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
 * - reflect
 * - strings
 * - testing
 * - time
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
	"reflect"
	"strings"
	"testing"
	"time"

	"nido/server/internal/ingestion/domain"
)

/**
 * Purpose:
 * Defines the ingestionStoreStub struct used by this package and its consumers.
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
type ingestionStoreStub struct {
	getRunFn       func(ctx context.Context, runID string) (domain.Run, error)
	getSourceFn    func(ctx context.Context, sourceID string) (domain.Source, error)
	upsertSourceFn func(ctx context.Context, source domain.Source) error
}

/**
 * Purpose:
 * Performs the UpsertSource operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - UpsertSource(ctx context.Context, source domain.Source) error
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
func (s ingestionStoreStub) UpsertSource(ctx context.Context, source domain.Source) error {
	if s.upsertSourceFn != nil {
		return s.upsertSourceFn(ctx, source)
	}

	return nil
}

/**
 * Purpose:
 * Performs the ListSources operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - ListSources(context.Context) ([]domain.Source, error)
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
func (s ingestionStoreStub) ListSources(context.Context) ([]domain.Source, error) { return nil, nil }

/**
 * Purpose:
 * Performs the ListDueSources operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - ListDueSources(context.Context, time.Time, int) ([]domain.Source, error)
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
func (s ingestionStoreStub) ListDueSources(context.Context, time.Time, int) ([]domain.Source, error) {
	return nil, nil
}

/**
 * Purpose:
 * Performs the GetSource operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - GetSource(ctx context.Context, sourceID string) (domain.Source, error)
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
func (s ingestionStoreStub) GetSource(ctx context.Context, sourceID string) (domain.Source, error) {
	if s.getSourceFn != nil {
		return s.getSourceFn(ctx, sourceID)
	}

	return domain.Source{}, nil
}

/**
 * Purpose:
 * Performs the DeleteSource operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - DeleteSource(context.Context, string) error
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
func (s ingestionStoreStub) DeleteSource(context.Context, string) error { return nil }

/**
 * Purpose:
 * Performs the UpdateSourceRunState operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - UpdateSourceRunState(context.Context, string, *time.Time, *time.Time) error
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
func (s ingestionStoreStub) UpdateSourceRunState(context.Context, string, *time.Time, *time.Time) error {
	return nil
}

/**
 * Purpose:
 * Performs the CountRunsSince operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - CountRunsSince(context.Context, string, time.Time) (int, error)
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
func (s ingestionStoreStub) CountRunsSince(context.Context, string, time.Time) (int, error) {
	return 0, nil
}

/**
 * Purpose:
 * Performs the TryAcquireIngestionLock operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - TryAcquireIngestionLock(context.Context, string, string, time.Time, time.Time) (bool, error)
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
func (s ingestionStoreStub) TryAcquireIngestionLock(context.Context, string, string, time.Time, time.Time) (bool, error) {
	return false, nil
}

/**
 * Purpose:
 * Performs the ReleaseIngestionLock operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - ReleaseIngestionLock(context.Context, string, string) error
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
func (s ingestionStoreStub) ReleaseIngestionLock(context.Context, string, string) error { return nil }

/**
 * Purpose:
 * Performs the CreateRun operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - CreateRun(context.Context, domain.Run) error
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
func (s ingestionStoreStub) CreateRun(context.Context, domain.Run) error { return nil }

/**
 * Purpose:
 * Performs the CompleteRun operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - CompleteRun(context.Context, string, time.Time, int, string, int, json.RawMessage) error
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
func (s ingestionStoreStub) CompleteRun(context.Context, string, time.Time, int, string, int, json.RawMessage) error {
	return nil
}

/**
 * Purpose:
 * Performs the FailRun operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - FailRun(context.Context, string, time.Time, string, string, int, json.RawMessage) error
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
func (s ingestionStoreStub) FailRun(context.Context, string, time.Time, string, string, int, json.RawMessage) error {
	return nil
}

/**
 * Purpose:
 * Performs the ListRuns operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - ListRuns(context.Context, string, int) ([]domain.Run, error)
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
func (s ingestionStoreStub) ListRuns(context.Context, string, int) ([]domain.Run, error) {
	return nil, nil
}

/**
 * Purpose:
 * Performs the GetRun operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - GetRun(ctx context.Context, runID string) (domain.Run, error)
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
func (s ingestionStoreStub) GetRun(ctx context.Context, runID string) (domain.Run, error) {
	if s.getRunFn != nil {
		return s.getRunFn(ctx, runID)
	}

	return domain.Run{}, nil
}

/**
 * Purpose:
 * Performs the RecordArtifact operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - RecordArtifact(context.Context, domain.Artifact) error
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
func (s ingestionStoreStub) RecordArtifact(context.Context, domain.Artifact) error { return nil }

/**
 * Purpose:
 * Performs the ReplaceObservedListings operation for this backend package.
 *
 * Parameters:
 * - s ingestionStoreStub
 *
 * Returns:
 * - ReplaceObservedListings(context.Context, string, time.Time, []domain.CandidateListing) ([]domain.ListingChange, error)
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
func (s ingestionStoreStub) ReplaceObservedListings(context.Context, string, time.Time, []domain.CandidateListing) ([]domain.ListingChange, error) {
	return nil, nil
}

/**
 * Purpose:
 * Performs the TestServiceEnsureSourceNormalizesAndReturnsStoredShape operation for this backend package.
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
func TestServiceEnsureSourceNormalizesAndReturnsStoredShape(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.April, 21, 12, 0, 0, 0, time.UTC)
	var stored domain.Source
	service, err := NewService(nil, ingestionStoreStub{
		upsertSourceFn: func(_ context.Context, source domain.Source) error {
			stored = source
			return nil
		},
	}, nil, []Connector{stubConnector{kind: "http-json-feed"}}, fixedClock{now: now}, 0, nil, nil)
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	source, err := service.EnsureSource(context.Background(), domain.Source{
		EndpointURL: "https://example.test/feed.json",
		ID:          "source-1",
		Kind:        "http-json-feed",
		Name:        "Source One",
	})
	if err != nil {
		t.Fatalf("ensure source: %v", err)
	}

	if source.ConfigJSON != "[]" {
		t.Fatalf("expected default config json, got %q", source.ConfigJSON)
	}
	if !source.CreatedAt.Equal(now) || !source.UpdatedAt.Equal(now) {
		t.Fatalf("expected timestamps to be normalized to %s, got created=%s updated=%s", now, source.CreatedAt, source.UpdatedAt)
	}
	if !reflect.DeepEqual(source, stored) {
		t.Fatalf("expected persisted source to match returned source\nwant: %#v\ngot:  %#v", source, stored)
	}
}

/**
 * Purpose:
 * Performs the TestServiceEnsureSourceRejectsInvalidJSONConfig operation for this backend package.
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
func TestServiceEnsureSourceRejectsInvalidJSONConfig(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.April, 21, 12, 0, 0, 0, time.UTC)
	service, err := NewService(nil, ingestionStoreStub{}, nil, nil, fixedClock{now: now}, 0, nil, nil)
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	_, err = service.EnsureSource(context.Background(), domain.Source{
		ID:         "template-1",
		Name:       "Template One",
		ConfigJSON: `{`,
	})
	if err == nil || !strings.Contains(err.Error(), "valid json") {
		t.Fatalf("expected json validation error, got %v", err)
	}
}

/**
 * Purpose:
 * Performs the TestServiceGetSourceMapsStoreNotFound operation for this backend package.
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
func TestServiceGetSourceMapsStoreNotFound(t *testing.T) {
	t.Parallel()

	service := &Service{store: ingestionStoreStub{getSourceFn: func(context.Context, string) (domain.Source, error) {
		return domain.Source{}, sql.ErrNoRows
	}}}

	_, err := service.GetSource(context.Background(), "missing-source")
	if !errors.Is(err, ErrSourceNotFound) {
		t.Fatalf("expected source not found error, got %v", err)
	}
}

/**
 * Purpose:
 * Performs the TestServiceGetRunMapsStoreNotFound operation for this backend package.
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
func TestServiceGetRunMapsStoreNotFound(t *testing.T) {
	t.Parallel()

	service := &Service{store: ingestionStoreStub{getRunFn: func(context.Context, string) (domain.Run, error) {
		return domain.Run{}, sql.ErrNoRows
	}}}

	_, err := service.GetRun(context.Background(), "missing-run")
	if !errors.Is(err, ErrRunNotFound) {
		t.Fatalf("expected run not found error, got %v", err)
	}
}

/**
 * Purpose:
 * Performs the TestServiceGetSourcePreservesUnexpectedErrors operation for this backend package.
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
func TestServiceGetSourcePreservesUnexpectedErrors(t *testing.T) {
	t.Parallel()

	expectedErr := errors.New("store unavailable")
	service := &Service{store: ingestionStoreStub{getSourceFn: func(context.Context, string) (domain.Source, error) {
		return domain.Source{}, expectedErr
	}}}

	_, err := service.GetSource(context.Background(), "source-1")
	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected original error, got %v", err)
	}
}

/**
 * Purpose:
 * Defines the fixedClock struct used by this package and its consumers.
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
type fixedClock struct {
	now time.Time
}

/**
 * Purpose:
 * Performs the Now operation for this backend package.
 *
 * Parameters:
 * - c fixedClock
 *
 * Returns:
 * - Now() time.Time
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
func (c fixedClock) Now() time.Time {
	return c.now
}

/**
 * Purpose:
 * Defines the stubConnector struct used by this package and its consumers.
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
type stubConnector struct {
	kind string
}

/**
 * Purpose:
 * Performs the Kind operation for this backend package.
 *
 * Parameters:
 * - c stubConnector
 *
 * Returns:
 * - Kind() string
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
func (c stubConnector) Kind() string {
	return c.kind
}

/**
 * Purpose:
 * Performs the Fetch operation for this backend package.
 *
 * Parameters:
 * - stubConnector
 *
 * Returns:
 * - Fetch(context.Context, domain.Source) (FetchResult, error)
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
func (stubConnector) Fetch(context.Context, domain.Source) (FetchResult, error) {
	return FetchResult{}, nil
}

/**
 * Purpose:
 * Performs the Parse operation for this backend package.
 *
 * Parameters:
 * - stubConnector
 *
 * Returns:
 * - Parse(context.Context, domain.Source, []byte) ([]domain.CandidateListing, error)
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
func (stubConnector) Parse(context.Context, domain.Source, []byte) ([]domain.CandidateListing, error) {
	return nil, nil
}
