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

	"home-searcher/server/internal/engine"
	ingestiondomain "home-searcher/server/internal/ingestion/domain"
	"home-searcher/server/internal/platform/id"
)

// PropertySchedulerStore defines the persistence contract for PropertyScheduler.
type PropertySchedulerStore interface {
	ListDueProperties(ctx context.Context, before time.Time, limit int) ([]ingestiondomain.Property, error)
	GetProperty(ctx context.Context, propertyID string) (ingestiondomain.Property, error)
	UpdatePropertyRunState(ctx context.Context, propertyID string, status ingestiondomain.PropertyStatus, lastRunAt, nextRunAt *time.Time) error
	CreatePropertyRun(ctx context.Context, run ingestiondomain.PropertyRun) error
	UpdatePropertyRun(ctx context.Context, run ingestiondomain.PropertyRun) error
	CountRecentPropertyRuns(ctx context.Context, propertyID string, since time.Time) (int, error)
}

// PropertyRunner executes property ingestion runs.
type PropertyRunner interface {
	IngestPropertyOnce(ctx context.Context, propertyID string, attemptNum int, runID string) (ingestiondomain.PropertySnapshot, error)
}

// PropertySchedulerConfig holds configuration for the property scheduler.
type PropertySchedulerConfig struct {
	TickInterval         time.Duration
	GlobalConcurrency    int
	PerDomainConcurrency int
}

// PropertyScheduler periodically checks for due properties and schedules them for ingestion.
type PropertyScheduler struct {
	logger  *slog.Logger
	store   PropertySchedulerStore
	runner  PropertyRunner
	pool    *engine.WorkerPool
	clock   Clock
	events  Publisher
	config  PropertySchedulerConfig
	
	mu               sync.Mutex
	runningProperties map[string]bool
	domainSemaphores  map[string]chan struct{}
	
	ctx    context.Context
	cancel context.CancelFunc
	done   chan struct{}
}

// NewPropertyScheduler creates a new property scheduler.
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
		runningProperties: make(map[string]bool),
		domainSemaphores:  make(map[string]chan struct{}),
		ctx:               ctx,
		cancel:            cancel,
		done:              make(chan struct{}),
	}
}

// Start begins the scheduling loop.
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

// Stop gracefully shuts down the scheduler.
func (s *PropertyScheduler) Stop() {
	s.cancel()
	<-s.done
}

func (s *PropertyScheduler) tick() {
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

func (s *PropertyScheduler) isRunning(propertyID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.runningProperties[propertyID]
}

func (s *PropertyScheduler) markRunning(propertyID string, running bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if running {
		s.runningProperties[propertyID] = true
	} else {
		delete(s.runningProperties, propertyID)
	}
}

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

func (s *PropertyScheduler) schedulePropertyRun(property ingestiondomain.Property) {
	s.emit("run.scheduled", map[string]any{
		"property_id": property.ID,
		"scheduled_at": s.clock.Now().UTC(),
	})

	s.pool.Submit(func(ctx context.Context) error {
		s.executePropertyRun(property)
		return nil
	})
}

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

func (s *PropertyScheduler) extractDomain(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "unknown"
	}
	return parsed.Host
}

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

func (s *PropertyScheduler) emit(eventType string, data map[string]any) {
	if s.events != nil {
		s.events.Publish(eventType, data)
	}
}

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
