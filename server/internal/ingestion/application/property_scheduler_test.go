/**
 * File: internal/ingestion/application/property_scheduler_test.go
 *
 * Purpose:
 * Validates the application package behavior covered by property_scheduler_test.go.
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
 * - errors
 * - sync
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
	"errors"
	"sync"
	"testing"
	"time"

	ingestiondomain "nido/server/internal/ingestion/domain"
)

/**
 * Purpose:
 * Defines the propertySchedulerStoreStub struct used by this package and its consumers.
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
type propertySchedulerStoreStub struct {
	mu                  sync.Mutex
	properties          []ingestiondomain.Property
	runs                []ingestiondomain.PropertyRun
	updateRunStateCalls []updateRunStateCall
	createRunCalls      int
	updateRunCalls      int
}

/**
 * Purpose:
 * Defines the updateRunStateCall struct used by this package and its consumers.
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
type updateRunStateCall struct {
	propertyID string
	status     ingestiondomain.PropertyStatus
	lastRunAt  *time.Time
	nextRunAt  *time.Time
}

/**
 * Purpose:
 * Performs the ListDueProperties operation for this backend package.
 *
 * Parameters:
 * - s *propertySchedulerStoreStub
 *
 * Returns:
 * - ListDueProperties(ctx context.Context, before time.Time, limit int) ([]ingestiondomain.Property, error)
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
func (s *propertySchedulerStoreStub) ListDueProperties(ctx context.Context, before time.Time, limit int) ([]ingestiondomain.Property, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	due := make([]ingestiondomain.Property, 0)
	for _, p := range s.properties {
		if p.ScheduleIntervalSeconds > 0 && p.NextRunAt != nil && p.NextRunAt.Before(before) {
			due = append(due, p)
		}
	}
	return due, nil
}

/**
 * Purpose:
 * Performs the GetProperty operation for this backend package.
 *
 * Parameters:
 * - s *propertySchedulerStoreStub
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
func (s *propertySchedulerStoreStub) GetProperty(ctx context.Context, propertyID string) (ingestiondomain.Property, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, p := range s.properties {
		if p.ID == propertyID {
			return p, nil
		}
	}
	return ingestiondomain.Property{}, errors.New("property not found")
}

/**
 * Purpose:
 * Performs the UpdatePropertyRunState operation for this backend package.
 *
 * Parameters:
 * - s *propertySchedulerStoreStub
 *
 * Returns:
 * - UpdatePropertyRunState(ctx context.Context, propertyID string, status ingestiondomain.PropertyStatus, lastRunAt, nextRunAt *time.Time) error
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
func (s *propertySchedulerStoreStub) UpdatePropertyRunState(ctx context.Context, propertyID string, status ingestiondomain.PropertyStatus, lastRunAt, nextRunAt *time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.updateRunStateCalls = append(s.updateRunStateCalls, updateRunStateCall{
		propertyID: propertyID,
		status:     status,
		lastRunAt:  lastRunAt,
		nextRunAt:  nextRunAt,
	})

	for i := range s.properties {
		if s.properties[i].ID == propertyID {
			s.properties[i].Status = status
			s.properties[i].LastRunAt = lastRunAt
			s.properties[i].NextRunAt = nextRunAt
			return nil
		}
	}
	return nil
}

/**
 * Purpose:
 * Performs the CreatePropertyRun operation for this backend package.
 *
 * Parameters:
 * - s *propertySchedulerStoreStub
 *
 * Returns:
 * - CreatePropertyRun(ctx context.Context, run ingestiondomain.PropertyRun) error
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
func (s *propertySchedulerStoreStub) CreatePropertyRun(ctx context.Context, run ingestiondomain.PropertyRun) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.runs = append(s.runs, run)
	s.createRunCalls++
	return nil
}

/**
 * Purpose:
 * Performs the UpdatePropertyRun operation for this backend package.
 *
 * Parameters:
 * - s *propertySchedulerStoreStub
 *
 * Returns:
 * - UpdatePropertyRun(ctx context.Context, run ingestiondomain.PropertyRun) error
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
func (s *propertySchedulerStoreStub) UpdatePropertyRun(ctx context.Context, run ingestiondomain.PropertyRun) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.updateRunCalls++
	for i := range s.runs {
		if s.runs[i].ID == run.ID {
			s.runs[i] = run
			return nil
		}
	}
	return nil
}

/**
 * Purpose:
 * Performs the CountRecentPropertyRuns operation for this backend package.
 *
 * Parameters:
 * - s *propertySchedulerStoreStub
 *
 * Returns:
 * - CountRecentPropertyRuns(ctx context.Context, propertyID string, since time.Time) (int, error)
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
func (s *propertySchedulerStoreStub) CountRecentPropertyRuns(ctx context.Context, propertyID string, since time.Time) (int, error) {
	return 0, nil
}

/**
 * Purpose:
 * Defines the propertyRunnerStub struct used by this package and its consumers.
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
type propertyRunnerStub struct {
	mu             sync.Mutex
	failureCount   int
	currentAttempt int
	ingestCalls    []ingestCall
}

/**
 * Purpose:
 * Defines the ingestCall struct used by this package and its consumers.
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
type ingestCall struct {
	propertyID string
	attemptNum int
	runID      string
}

/**
 * Purpose:
 * Performs the IngestPropertyOnce operation for this backend package.
 *
 * Parameters:
 * - r *propertyRunnerStub
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
func (r *propertyRunnerStub) IngestPropertyOnce(ctx context.Context, propertyID string, attemptNum int, runID string) (ingestiondomain.PropertySnapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.currentAttempt++
	r.ingestCalls = append(r.ingestCalls, ingestCall{
		propertyID: propertyID,
		attemptNum: attemptNum,
		runID:      runID,
	})

	// Fail for the first N attempts, then succeed
	if r.currentAttempt <= r.failureCount {
		return ingestiondomain.PropertySnapshot{
			ID:           "snap_" + runID,
			PropertyID:   propertyID,
			IsValid:      false,
			ErrorMessage: "simulated fetch error",
		}, errors.New("simulated fetch error")
	}

	return ingestiondomain.PropertySnapshot{
		ID:         "snap_" + runID,
		PropertyID: propertyID,
		IsValid:    true,
	}, nil
}

/**
 * Purpose:
 * Performs the TestPropertySchedulerRetryBehavior operation for this backend package.
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
func TestPropertySchedulerRetryBehavior(t *testing.T) {
	t.Parallel()

	now := time.Date(2024, time.January, 1, 12, 0, 0, 0, time.UTC)
	nextRun := now.Add(-1 * time.Hour) // Past due

	property := ingestiondomain.Property{
		ID:                      "prop_1",
		URL:                     "https://example.com/listing",
		ScheduleIntervalSeconds: 3600,
		RetryMaxAttempts:        3,
		RetryBackoffMillis:      100,
		NextRunAt:               &nextRun,
	}

	store := &propertySchedulerStoreStub{
		properties: []ingestiondomain.Property{property},
	}

	// Configure runner to fail twice, then succeed
	runner := &propertyRunnerStub{
		failureCount: 2,
	}

	scheduler := NewPropertyScheduler(
		nil,
		store,
		runner,
		fixedClock{now: now},
		nil,
		PropertySchedulerConfig{
			TickInterval:         10 * time.Millisecond,
			GlobalConcurrency:    1,
			PerDomainConcurrency: 1,
		},
	)

	// Run a single tick manually
	scheduler.tick()

	// Wait for async execution to complete
	time.Sleep(500 * time.Millisecond)

	// Verify the runner was called 3 times (2 failures + 1 success)
	runner.mu.Lock()
	ingestCallCount := len(runner.ingestCalls)
	runner.mu.Unlock()

	if ingestCallCount != 3 {
		t.Errorf("expected 3 ingest attempts, got %d", ingestCallCount)
	}

	// Verify attempts were numbered correctly
	runner.mu.Lock()
	for i, call := range runner.ingestCalls {
		expectedAttempt := i + 1
		if call.attemptNum != expectedAttempt {
			t.Errorf("attempt %d: expected attemptNum %d, got %d", i, expectedAttempt, call.attemptNum)
		}
	}
	runner.mu.Unlock()
}

/**
 * Purpose:
 * Performs the TestPropertySchedulerPicksDueProperties operation for this backend package.
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
func TestPropertySchedulerPicksDueProperties(t *testing.T) {
	t.Parallel()

	now := time.Date(2024, time.January, 1, 12, 0, 0, 0, time.UTC)
	pastDue := now.Add(-1 * time.Hour)
	futureDue := now.Add(1 * time.Hour)

	properties := []ingestiondomain.Property{
		{
			ID:                      "prop_1",
			URL:                     "https://example.com/listing1",
			ScheduleIntervalSeconds: 3600,
			RetryMaxAttempts:        1,
			NextRunAt:               &pastDue,
		},
		{
			ID:                      "prop_2",
			URL:                     "https://example.com/listing2",
			ScheduleIntervalSeconds: 3600,
			RetryMaxAttempts:        1,
			NextRunAt:               &futureDue,
		},
	}

	store := &propertySchedulerStoreStub{
		properties: properties,
	}

	runner := &propertyRunnerStub{}

	scheduler := NewPropertyScheduler(
		nil,
		store,
		runner,
		fixedClock{now: now},
		nil,
		PropertySchedulerConfig{
			TickInterval:         10 * time.Millisecond,
			GlobalConcurrency:    1,
			PerDomainConcurrency: 1,
		},
	)

	scheduler.tick()
	time.Sleep(200 * time.Millisecond)

	// Only prop_1 should have been picked up
	runner.mu.Lock()
	ingestCallCount := len(runner.ingestCalls)
	runner.mu.Unlock()

	if ingestCallCount != 1 {
		t.Errorf("expected 1 property to be ingested, got %d", ingestCallCount)
	}

	runner.mu.Lock()
	if len(runner.ingestCalls) > 0 && runner.ingestCalls[0].propertyID != "prop_1" {
		t.Errorf("expected prop_1 to be ingested, got %q", runner.ingestCalls[0].propertyID)
	}
	runner.mu.Unlock()
}

/**
 * Purpose:
 * Performs the TestPropertySchedulerSetsConfiguredNextRunAt operation for this backend package.
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
func TestPropertySchedulerSetsConfiguredNextRunAt(t *testing.T) {
	t.Parallel()

	now := time.Date(2024, time.January, 1, 12, 0, 0, 0, time.UTC)
	pastDue := now.Add(-30 * time.Minute)

	store := &propertySchedulerStoreStub{
		properties: []ingestiondomain.Property{
			{
				ID:                      "prop_1",
				URL:                     "https://example.com/listing",
				ScheduleIntervalSeconds: 7200,
				RetryMaxAttempts:        1,
				NextRunAt:               &pastDue,
			},
		},
	}

	scheduler := NewPropertyScheduler(
		nil,
		store,
		&propertyRunnerStub{},
		fixedClock{now: now},
		nil,
		PropertySchedulerConfig{TickInterval: 10 * time.Millisecond, GlobalConcurrency: 1, PerDomainConcurrency: 1},
	)

	scheduler.tick()

	store.mu.Lock()
	defer store.mu.Unlock()

	if len(store.updateRunStateCalls) == 0 || store.updateRunStateCalls[0].nextRunAt == nil {
		t.Fatal("expected scheduler to persist the next run timestamp")
	}

	expectedNextRun := pastDue.Add(2 * time.Hour)
	if !store.updateRunStateCalls[0].nextRunAt.Equal(expectedNextRun) {
		t.Fatalf("expected next run %v, got %v", expectedNextRun, *store.updateRunStateCalls[0].nextRunAt)
	}
}

/**
 * Purpose:
 * Performs the TestPropertySchedulerSkipsAlreadyRunningProperty operation for this backend package.
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
func TestPropertySchedulerSkipsAlreadyRunningProperty(t *testing.T) {
	t.Parallel()

	now := time.Date(2024, time.January, 1, 12, 0, 0, 0, time.UTC)
	pastDue := now.Add(-1 * time.Minute)
	runner := &propertyRunnerStub{}
	store := &propertySchedulerStoreStub{
		properties: []ingestiondomain.Property{
			{
				ID:                      "prop_1",
				URL:                     "https://example.com/listing",
				ScheduleIntervalSeconds: 60,
				RetryMaxAttempts:        1,
				NextRunAt:               &pastDue,
			},
		},
	}

	scheduler := NewPropertyScheduler(
		nil,
		store,
		runner,
		fixedClock{now: now},
		nil,
		PropertySchedulerConfig{TickInterval: 10 * time.Millisecond, GlobalConcurrency: 1, PerDomainConcurrency: 1},
	)
	scheduler.markRunning("prop_1", true)

	scheduler.tick()
	time.Sleep(100 * time.Millisecond)

	runner.mu.Lock()
	defer runner.mu.Unlock()
	if len(runner.ingestCalls) != 0 {
		t.Fatalf("expected running property to be skipped, got %d runs", len(runner.ingestCalls))
	}
}

/**
 * Purpose:
 * Performs the TestPropertySchedulerBackoffCalculation operation for this backend package.
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
func TestPropertySchedulerBackoffCalculation(t *testing.T) {
	scheduler := &PropertyScheduler{
		config: PropertySchedulerConfig{},
	}

	baseBackoff := 500 * time.Millisecond

	// Test attempt 1: should be close to baseBackoff (500ms * 2^0 = 500ms)
	backoff1 := scheduler.calculateBackoff(1, baseBackoff)
	if backoff1 < 400*time.Millisecond || backoff1 > 600*time.Millisecond {
		t.Errorf("attempt 1: expected backoff around 500ms, got %v", backoff1)
	}

	// Test attempt 2: should be close to 1000ms (500ms * 2^1 = 1000ms)
	backoff2 := scheduler.calculateBackoff(2, baseBackoff)
	if backoff2 < 800*time.Millisecond || backoff2 > 1200*time.Millisecond {
		t.Errorf("attempt 2: expected backoff around 1000ms, got %v", backoff2)
	}

	// Test attempt 3: should be close to 2000ms (500ms * 2^2 = 2000ms)
	backoff3 := scheduler.calculateBackoff(3, baseBackoff)
	if backoff3 < 1600*time.Millisecond || backoff3 > 2400*time.Millisecond {
		t.Errorf("attempt 3: expected backoff around 2000ms, got %v", backoff3)
	}

	// Test high attempt: should cap at 5 minutes
	backoff10 := scheduler.calculateBackoff(10, baseBackoff)
	if backoff10 > 6*time.Minute {
		t.Errorf("attempt 10: expected backoff capped at 5 min, got %v", backoff10)
	}
}
