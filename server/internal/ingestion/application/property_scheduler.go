/**
 * File: internal/ingestion/application/property_scheduler.go
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
 * - context
 * - crypto/rand
 * - log/slog
 * - math
 * - math/big
 * - net/url
 * - sync
 * - time
 * - nido/server/internal/engine
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
	"context"
	"crypto/rand"
	"log/slog"
	"math"
	"math/big"
	"net/url"
	"sync"
	"time"

	"nido/server/internal/engine"
	ingestiondomain "nido/server/internal/ingestion/domain"
	"nido/server/internal/platform/id"
)

/**
 * @critical
 * Description: Property scheduling coordinates global and per-domain concurrency for background ingestion runs.
 * Why critical: Duplicate or excessive scheduling can overload external sources and create stale or conflicting run state.
 * What can break: Property refresh cadence, source rate-limit compliance, run status accuracy, and downstream notifications.
 * Failure conditions: Multiple writer processes, long-running fetches, disabled locks, or concurrency settings above source capacity.
 */

/**
 * Purpose:
 * Defines the PropertySchedulerStore interface used by this package and its consumers.
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
type PropertySchedulerStore interface {
	ListDueProperties(ctx context.Context, before time.Time, limit int) ([]ingestiondomain.Property, error)
	GetProperty(ctx context.Context, propertyID string) (ingestiondomain.Property, error)
	UpdatePropertyRunState(ctx context.Context, propertyID string, status ingestiondomain.PropertyStatus, lastRunAt, nextRunAt *time.Time) error
	CreatePropertyRun(ctx context.Context, run ingestiondomain.PropertyRun) error
	UpdatePropertyRun(ctx context.Context, run ingestiondomain.PropertyRun) error
	CountRecentPropertyRuns(ctx context.Context, propertyID string, since time.Time) (int, error)
}

/**
 * Purpose:
 * Defines the PropertyRunner interface used by this package and its consumers.
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
type PropertyRunner interface {
	IngestPropertyOnce(ctx context.Context, propertyID string, attemptNum int, runID string) (ingestiondomain.PropertySnapshot, error)
}

/**
 * Purpose:
 * Defines the PropertySchedulerConfig struct used by this package and its consumers.
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
type PropertySchedulerConfig struct {
	TickInterval         time.Duration
	GlobalConcurrency    int
	PerDomainConcurrency int
}

/**
 * Purpose:
 * Defines the PropertyScheduler struct used by this package and its consumers.
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
type PropertyScheduler struct {
	logger *slog.Logger
	store  PropertySchedulerStore
	runner PropertyRunner
	pool   *engine.WorkerPool
	clock  Clock
	events Publisher
	config PropertySchedulerConfig

	mu                sync.Mutex
	runningProperties map[string]bool
	domainSemaphores  map[string]chan struct{}
	enabled           bool

	ctx    context.Context
	cancel context.CancelFunc
	done   chan struct{}
}

/**
 * Purpose:
 * Performs the NewPropertyScheduler operation for this backend package.
 *
 * Parameters:
 * - logger *slog.Logger, store PropertySchedulerStore, runner PropertyRunner, clock Clock, events Publisher, config PropertySchedulerConfig
 *
 * Returns:
 * - *PropertyScheduler
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
func NewPropertyScheduler(
	logger *slog.Logger,
	store PropertySchedulerStore,
	runner PropertyRunner,
	clock Clock,
	events Publisher,
	config PropertySchedulerConfig,
) *PropertyScheduler {
	resolvedClock := clock
	if resolvedClock == nil {
		resolvedClock = systemClock{}
	}

	if config.TickInterval <= 0 {
		config.TickInterval = 10 * time.Second
	}
	if config.GlobalConcurrency <= 0 {
		config.GlobalConcurrency = 4
	}
	if config.PerDomainConcurrency <= 0 {
		config.PerDomainConcurrency = 1
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &PropertyScheduler{
		logger:            logger,
		store:             store,
		runner:            runner,
		pool:              engine.NewWorkerPool(engine.WorkerPoolConfig{Workers: config.GlobalConcurrency, Logger: logger}),
		clock:             resolvedClock,
		events:            events,
		config:            config,
		enabled:           true,
		runningProperties: make(map[string]bool),
		domainSemaphores:  make(map[string]chan struct{}),
		ctx:               ctx,
		cancel:            cancel,
		done:              make(chan struct{}),
	}
}

/**
 * Purpose:
 * Performs the Start operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - Start()
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
func (s *PropertyScheduler) Start() {
	go func() {
		defer close(s.done)
		ticker := time.NewTicker(s.config.TickInterval)
		defer ticker.Stop()

		for {
			select {
			case <-s.ctx.Done():
				_ = s.pool.Shutdown(context.Background())
				return
			case <-ticker.C:
				s.tick()
			}
		}
	}()
}

/**
 * Purpose:
 * Performs the Stop operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - Stop()
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
func (s *PropertyScheduler) Stop() {
	s.cancel()
	<-s.done
}

/**
 * Purpose:
 * Performs the tick operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - tick()
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
func (s *PropertyScheduler) tick() {
	if !s.Enabled() {
		return
	}
	now := s.clock.Now().UTC()
	properties, err := s.store.ListDueProperties(s.ctx, now, 100)
	if err != nil {
		if s.logger != nil {
			s.logger.Error("failed to list due properties", "error", err)
		}
		return
	}

	for _, property := range properties {
		// Skip if already running
		if s.isRunning(property.ID) {
			continue
		}

		// Check idempotency window
		if s.isDuplicateRun(property) {
			continue
		}

		// Mark as running and update next_run_at immediately to avoid double-scheduling
		s.markRunning(property.ID, true)
		nextRun := advancePropertyRunAt(now, property.NextRunAt, property.ScheduleInterval())
		if err := s.store.UpdatePropertyRunState(s.ctx, property.ID, property.Status, nil, nextRun); err != nil {
			s.markRunning(property.ID, false)
			if s.logger != nil {
				s.logger.Error("failed to update property run state", "property_id", property.ID, "error", err)
			}
			continue
		}

		// Schedule the run
		s.schedulePropertyRun(property)
	}
}

/**
 * Purpose:
 * Performs the SetEnabled operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - SetEnabled(enabled bool)
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
func (s *PropertyScheduler) SetEnabled(enabled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.enabled = enabled
}

/**
 * Purpose:
 * Performs the Enabled operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - Enabled() bool
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
func (s *PropertyScheduler) Enabled() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.enabled
}

/**
 * Purpose:
 * Performs the RunningCount operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - RunningCount() int
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
func (s *PropertyScheduler) RunningCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.runningProperties)
}

/**
 * Purpose:
 * Performs the isRunning operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - isRunning(propertyID string) bool
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
func (s *PropertyScheduler) isRunning(propertyID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.runningProperties[propertyID]
}

/**
 * Purpose:
 * Performs the markRunning operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - markRunning(propertyID string, running bool)
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
func (s *PropertyScheduler) markRunning(propertyID string, running bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if running {
		s.runningProperties[propertyID] = true
	} else {
		delete(s.runningProperties, propertyID)
	}
}

/**
 * Purpose:
 * Performs the isDuplicateRun operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - isDuplicateRun(property ingestiondomain.Property) bool
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
func (s *PropertyScheduler) isDuplicateRun(property ingestiondomain.Property) bool {
	if property.LastRunAt == nil {
		return false
	}

	now := s.clock.Now().UTC()
	idempotencyWindow := property.ScheduleInterval() / 2
	if idempotencyWindow > 60*time.Second {
		idempotencyWindow = 60 * time.Second
	}

	timeSinceLastRun := now.Sub(*property.LastRunAt)
	return timeSinceLastRun < idempotencyWindow
}

/**
 * Purpose:
 * Performs the schedulePropertyRun operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - schedulePropertyRun(property ingestiondomain.Property)
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
func (s *PropertyScheduler) schedulePropertyRun(property ingestiondomain.Property) {
	s.emit("run.scheduled", map[string]any{
		"property_id":  property.ID,
		"scheduled_at": s.clock.Now().UTC(),
	})

	s.pool.Submit(func(ctx context.Context) error {
		s.executePropertyRun(property)
		return nil
	})
}

/**
 * Purpose:
 * Performs the executePropertyRun operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - executePropertyRun(property ingestiondomain.Property)
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
func (s *PropertyScheduler) executePropertyRun(property ingestiondomain.Property) {
	defer s.markRunning(property.ID, false)

	// Acquire domain semaphore
	domain := s.extractDomain(property.URL)
	sem := s.getDomainSemaphore(domain)

	select {
	case sem <- struct{}{}:
		defer func() { <-sem }()
	case <-s.ctx.Done():
		return
	}

	// Execute run with retries
	s.runWithRetries(s.ctx, property, ingestiondomain.TriggerKindScheduled)
}

/**
 * Purpose:
 * Performs the runWithRetries operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - runWithRetries(ctx context.Context, property ingestiondomain.Property, triggerKind string)
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
func (s *PropertyScheduler) runWithRetries(ctx context.Context, property ingestiondomain.Property, triggerKind string) {
	now := s.clock.Now().UTC()
	maxAttempts := property.RetryAttempts()
	if maxAttempts <= 0 {
		maxAttempts = 1
	}

	run := ingestiondomain.PropertyRun{
		ID:           id.New("prun"),
		PropertyID:   property.ID,
		Status:       ingestiondomain.PropertyRunStatusPending,
		TriggerKind:  triggerKind,
		AttemptCount: 0,
		MaxAttempts:  maxAttempts,
		CreatedAt:    now,
	}

	if err := s.store.CreatePropertyRun(ctx, run); err != nil {
		if s.logger != nil {
			s.logger.Error("failed to create property run", "property_id", property.ID, "error", err)
		}
		return
	}

	var lastError error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		run.AttemptCount = attempt
		run.Status = ingestiondomain.PropertyRunStatusRunning
		startedAt := s.clock.Now().UTC()
		run.StartedAt = &startedAt

		if err := s.store.UpdatePropertyRun(ctx, run); err != nil {
			if s.logger != nil {
				s.logger.Error("failed to update property run", "run_id", run.ID, "error", err)
			}
			continue
		}

		s.emit("run.started", map[string]any{
			"property_id": property.ID,
			"run_id":      run.ID,
			"attempt":     attempt,
		})

		snapshot, err := s.runner.IngestPropertyOnce(ctx, property.ID, attempt, run.ID)
		finishedAt := s.clock.Now().UTC()
		run.FinishedAt = &finishedAt

		if err == nil && snapshot.IsValid {
			// Success
			run.Status = ingestiondomain.PropertyRunStatusSuccess
			run.SnapshotID = snapshot.ID
			if err := s.store.UpdatePropertyRun(ctx, run); err != nil {
				if s.logger != nil {
					s.logger.Error("failed to update property run", "run_id", run.ID, "error", err)
				}
			}

			s.emit("run.completed", map[string]any{
				"property_id": property.ID,
				"run_id":      run.ID,
				"snapshot_id": snapshot.ID,
				"is_valid":    snapshot.IsValid,
			})

			return
		}

		// Failure
		lastError = err
		if err != nil {
			run.ErrorMessage = err.Error()
		} else if !snapshot.IsValid {
			run.ErrorMessage = snapshot.ErrorMessage
			run.SnapshotID = snapshot.ID
		}

		run.Status = ingestiondomain.PropertyRunStatusFailed
		if err := s.store.UpdatePropertyRun(ctx, run); err != nil {
			if s.logger != nil {
				s.logger.Error("failed to update property run", "run_id", run.ID, "error", err)
			}
		}

		if attempt < maxAttempts {
			// Calculate backoff with jitter
			backoff := s.calculateBackoff(attempt, property.RetryBackoff())

			if s.logger != nil {
				s.logger.Info("property run failed, retrying",
					"property_id", property.ID,
					"attempt", attempt,
					"max_attempts", maxAttempts,
					"backoff", backoff,
					"error", run.ErrorMessage,
				)
			}

			select {
			case <-time.After(backoff):
				// Continue to next attempt
			case <-ctx.Done():
				return
			}
		}
	}

	// All attempts failed
	s.emit("run.failed", map[string]any{
		"property_id": property.ID,
		"run_id":      run.ID,
		"error":       run.ErrorMessage,
		"attempts":    maxAttempts,
	})

	if s.logger != nil {
		s.logger.Error("property run failed after all retries",
			"property_id", property.ID,
			"run_id", run.ID,
			"attempts", maxAttempts,
			"error", lastError,
		)
	}
}

/**
 * Purpose:
 * Performs the calculateBackoff operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - calculateBackoff(attempt int, baseBackoff time.Duration) time.Duration
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
func (s *PropertyScheduler) calculateBackoff(attempt int, baseBackoff time.Duration) time.Duration {
	if baseBackoff <= 0 {
		baseBackoff = 500 * time.Millisecond
	}

	// Exponential backoff: base * 2^(attempt-1)
	exponent := attempt - 1
	backoff := float64(baseBackoff) * math.Pow(2, float64(exponent))

	// Cap at 5 minutes
	maxBackoff := 5 * 60 * 1000 * float64(time.Millisecond)
	if backoff > maxBackoff {
		backoff = maxBackoff
	}

	// Add jitter: ±20%
	jitterFactor := 0.2
	jitter := backoff * jitterFactor

	// Generate random jitter value between -jitter and +jitter
	maxJitter := big.NewInt(int64(jitter * 2))
	randomJitter, err := rand.Int(rand.Reader, maxJitter)
	if err != nil {
		randomJitter = big.NewInt(0)
	}

	finalBackoff := backoff - jitter + float64(randomJitter.Int64())
	if finalBackoff < 0 {
		finalBackoff = 0
	}

	return time.Duration(finalBackoff)
}

/**
 * Purpose:
 * Performs the extractDomain operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - extractDomain(rawURL string) string
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
func (s *PropertyScheduler) extractDomain(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "unknown"
	}
	return parsed.Host
}

/**
 * Purpose:
 * Performs the getDomainSemaphore operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - getDomainSemaphore(domain string) chan struct
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
func (s *PropertyScheduler) getDomainSemaphore(domain string) chan struct{} {
	s.mu.Lock()
	defer s.mu.Unlock()

	if sem, ok := s.domainSemaphores[domain]; ok {
		return sem
	}

	sem := make(chan struct{}, s.config.PerDomainConcurrency)
	s.domainSemaphores[domain] = sem
	return sem
}

/**
 * Purpose:
 * Performs the emit operation for this backend package.
 *
 * Parameters:
 * - s *PropertyScheduler
 *
 * Returns:
 * - emit(eventType string, data map[string]any)
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
func (s *PropertyScheduler) emit(eventType string, data map[string]any) {
	if s.events != nil {
		s.events.Publish(eventType, data)
	}
}

/**
 * Purpose:
 * Performs the advancePropertyRunAt operation for this backend package.
 *
 * Parameters:
 * - now time.Time, scheduledAt *time.Time, interval time.Duration
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
func advancePropertyRunAt(now time.Time, scheduledAt *time.Time, interval time.Duration) *time.Time {
	if interval <= 0 {
		return nil
	}
	if scheduledAt == nil {
		return nextPropertyRunAt(now, interval)
	}

	nextRun := scheduledAt.UTC()
	for !nextRun.After(now) {
		nextRun = nextRun.Add(interval)
	}

	return &nextRun
}
