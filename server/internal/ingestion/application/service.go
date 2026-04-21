package application

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"path"
	"strings"
	"time"

	"home-searcher/server/internal/ingestion/domain"
	"home-searcher/server/internal/platform/id"
	"home-searcher/server/internal/platform/objectstore"
)

// ErrSourceNotFound indicates that the requested source does not exist.
var ErrSourceNotFound = errors.New("source not found")

// ErrRunNotFound indicates that the requested run does not exist.
var ErrRunNotFound = errors.New("run not found")

// ErrSourceLocked indicates that another ingest is already running for a source.
var ErrSourceLocked = errors.New("source is already being ingested")

// ErrSourceRateLimited indicates that source rate limits would be exceeded.
var ErrSourceRateLimited = errors.New("source rate limit exceeded")

// Connector fetches and parses a source payload.
type Connector interface {
	Kind() string
	Fetch(ctx context.Context, source domain.Source) (FetchResult, error)
	Parse(ctx context.Context, source domain.Source, payload []byte) ([]domain.CandidateListing, error)
}

// SourceValidator optionally validates whether a source payload is usable for a connector.
type SourceValidator interface {
	ValidateSource(source domain.Source) error
}

// Store defines the persistence contract required by the ingestion service.
type Store interface {
	UpsertSource(ctx context.Context, source domain.Source) error
	ListSources(ctx context.Context) ([]domain.Source, error)
	ListDueSources(ctx context.Context, before time.Time, limit int) ([]domain.Source, error)
	GetSource(ctx context.Context, sourceID string) (domain.Source, error)
	UpdateSourceRunState(ctx context.Context, sourceID string, lastRunAt, nextRunAt *time.Time) error
	CountRunsSince(ctx context.Context, sourceID string, since time.Time) (int, error)
	TryAcquireIngestionLock(ctx context.Context, sourceID, holderID string, acquiredAt, expiresAt time.Time) (bool, error)
	ReleaseIngestionLock(ctx context.Context, sourceID, holderID string) error
	CreateRun(ctx context.Context, run domain.Run) error
	CompleteRun(ctx context.Context, runID string, finishedAt time.Time, itemCount int, artifactKey string, attemptCount int, diagnostics json.RawMessage) error
	FailRun(ctx context.Context, runID string, finishedAt time.Time, errorMessage string, failureArtifactKey string, attemptCount int, diagnostics json.RawMessage) error
	ListRuns(ctx context.Context, sourceID string, limit int) ([]domain.Run, error)
	GetRun(ctx context.Context, runID string) (domain.Run, error)
	RecordArtifact(ctx context.Context, artifact domain.Artifact) error
	ReplaceObservedListings(ctx context.Context, sourceID string, observedAt time.Time, candidates []domain.CandidateListing) ([]domain.ListingChange, error)
}

// FetchResult contains the raw payload returned by a source fetch.
type FetchResult struct {
	Payload     []byte
	ContentType string
	FetchedAt   time.Time
}

// Clock abstracts time access for ingestion flows.
type Clock interface {
	Now() time.Time
}

// ChangeProcessor reacts to detected listing changes.
type ChangeProcessor interface {
	ProcessIngestionChanges(ctx context.Context, changes []domain.ListingChange) (int, error)
}

// Publisher emits live transport events.
type Publisher interface {
	Publish(eventType string, data any)
}

// IngestOptions controls how a run is executed.
type IngestOptions struct {
	TriggerKind string
	Force       bool
}

// Service orchestrates source registration, ingestion execution, and run reads.
type Service struct {
	logger     *slog.Logger
	store      Store
	artifacts  objectstore.Store
	connectors map[string]Connector
	clock      Clock
	lockTTL    time.Duration
	changes    ChangeProcessor
	events     Publisher
}

// NewService builds an ingestion service.
func NewService(logger *slog.Logger, store Store, artifacts objectstore.Store, connectors []Connector, clock Clock, lockTTL time.Duration, changes ChangeProcessor, events Publisher) (*Service, error) {
	resolvedClock := clock
	if resolvedClock == nil {
		resolvedClock = systemClock{}
	}
	if lockTTL <= 0 {
		lockTTL = 2 * time.Minute
	}

	connectorRegistry := make(map[string]Connector, len(connectors))
	for _, connector := range connectors {
		kind := strings.TrimSpace(connector.Kind())
		if kind == "" {
			return nil, fmt.Errorf("connector kind cannot be empty")
		}
		if _, exists := connectorRegistry[kind]; exists {
			return nil, fmt.Errorf("duplicate connector kind %q", kind)
		}

		connectorRegistry[kind] = connector
	}

	return &Service{
		logger:     logger,
		store:      store,
		artifacts:  artifacts,
		connectors: connectorRegistry,
		clock:      resolvedClock,
		lockTTL:    lockTTL,
		changes:    changes,
		events:     events,
	}, nil
}

// EnsureSource upserts a source definition used by the first iteration.
func (s *Service) EnsureSource(ctx context.Context, source domain.Source) (domain.Source, error) {
	normalized, err := s.normalizeAndValidateSource(source)
	if err != nil {
		return domain.Source{}, err
	}

	if err := s.store.UpsertSource(ctx, normalized); err != nil {
		return domain.Source{}, err
	}

	return normalized, nil
}

// ListSources returns the configured sources.
func (s *Service) ListSources(ctx context.Context) ([]domain.Source, error) {
	return s.store.ListSources(ctx)
}

// ListRuns returns recent ingestion runs.
func (s *Service) ListRuns(ctx context.Context, sourceID string, limit int) ([]domain.Run, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	return s.store.ListRuns(ctx, sourceID, limit)
}

// GetRun returns one run with diagnostics.
func (s *Service) GetRun(ctx context.Context, runID string) (domain.Run, error) {
	run, err := s.store.GetRun(ctx, runID)
	if err != nil {
		return domain.Run{}, mapLookupError(err, ErrRunNotFound)
	}

	return run, nil
}

// GetSource returns one configured source.
func (s *Service) GetSource(ctx context.Context, sourceID string) (domain.Source, error) {
	source, err := s.store.GetSource(ctx, sourceID)
	if err != nil {
		return domain.Source{}, mapLookupError(err, ErrSourceNotFound)
	}

	return source, nil
}

func normalizeSourceForUpsert(source domain.Source, now time.Time) domain.Source {
	source.ID = strings.TrimSpace(source.ID)
	source.Name = strings.TrimSpace(source.Name)
	source.Kind = strings.TrimSpace(source.Kind)
	source.EndpointURL = strings.TrimSpace(source.EndpointURL)
	source.ConfigJSON = strings.TrimSpace(source.ConfigJSON)
	if strings.TrimSpace(source.ConfigJSON) == "" {
		source.ConfigJSON = "{}"
	}
	if source.CreatedAt.IsZero() {
		source.CreatedAt = now
	}
	if source.UpdatedAt.IsZero() {
		source.UpdatedAt = now
	}

	return source
}

func (s *Service) normalizeAndValidateSource(source domain.Source) (domain.Source, error) {
	normalized := normalizeSourceForUpsert(source, s.clock.Now().UTC())
	if normalized.ID == "" {
		return domain.Source{}, fmt.Errorf("source id is required")
	}
	if normalized.Name == "" {
		return domain.Source{}, fmt.Errorf("source name is required")
	}
	if normalized.Kind == "" {
		return domain.Source{}, fmt.Errorf("source kind is required")
	}
	if normalized.EndpointURL == "" {
		return domain.Source{}, fmt.Errorf("source endpoint url is required")
	}
	if _, err := url.ParseRequestURI(normalized.EndpointURL); err != nil {
		return domain.Source{}, fmt.Errorf("invalid source endpoint url: %w", err)
	}

	connector, ok := s.connectors[normalized.Kind]
	if !ok {
		return domain.Source{}, fmt.Errorf("no connector registered for source kind %q", normalized.Kind)
	}
	if validator, ok := connector.(SourceValidator); ok {
		if err := validator.ValidateSource(normalized); err != nil {
			return domain.Source{}, err
		}
	}

	return normalized, nil
}

func mapLookupError(err error, notFound error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return notFound
	}

	return err
}

// IngestSource runs a synchronous ingestion for the supplied source.
func (s *Service) IngestSource(ctx context.Context, sourceID string, options IngestOptions) (domain.Run, error) {
	source, err := s.store.GetSource(ctx, sourceID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Run{}, ErrSourceNotFound
		}

		return domain.Run{}, err
	}

	connector, ok := s.connectors[source.Kind]
	if !ok {
		return domain.Run{}, fmt.Errorf("no connector registered for source kind %q", source.Kind)
	}
	if !source.Active {
		return domain.Run{}, fmt.Errorf("source %q is inactive", source.ID)
	}

	triggerKind := strings.TrimSpace(options.TriggerKind)
	if triggerKind == "" {
		triggerKind = domain.TriggerKindManual
	}
	if !options.Force && source.RateLimitWindow() > 0 && source.RateLimitMaxRequests > 0 {
		runCount, err := s.store.CountRunsSince(ctx, source.ID, s.clock.Now().UTC().Add(-source.RateLimitWindow()))
		if err != nil {
			return domain.Run{}, err
		}
		if runCount >= source.RateLimitMaxRequests {
			return domain.Run{}, ErrSourceRateLimited
		}
	}

	lockHolder := id.New("lock")
	now := s.clock.Now().UTC()
	acquired, err := s.store.TryAcquireIngestionLock(ctx, source.ID, lockHolder, now, now.Add(s.lockTTL))
	if err != nil {
		return domain.Run{}, err
	}
	if !acquired {
		return domain.Run{}, ErrSourceLocked
	}
	defer func() {
		if err := s.store.ReleaseIngestionLock(ctx, source.ID, lockHolder); err != nil {
			s.logger.Error("release ingestion lock", "source_id", source.ID, "error", err.Error())
		}
	}()

	startedAt := now
	run := domain.Run{
		ID:            id.New("run"),
		SourceID:      source.ID,
		CorrelationID: id.New("corr"),
		TriggerKind:   triggerKind,
		Status:        domain.RunStatusRunning,
		StartedAt:     startedAt,
		AttemptCount:  0,
		Diagnostics:   json.RawMessage(`{"stage":"starting"}`),
	}

	if err := s.store.CreateRun(ctx, run); err != nil {
		return domain.Run{}, err
	}
	s.emit("ingestion.run.started", map[string]any{"run_id": run.ID, "source_id": source.ID, "correlation_id": run.CorrelationID, "trigger_kind": triggerKind})

	diagnostics := map[string]any{
		"connector_kind":  source.Kind,
		"endpoint_url":    source.EndpointURL,
		"trigger_kind":    triggerKind,
		"browser_enabled": source.BrowserEnabled,
	}

	var (
		fetchResult FetchResult
		lastErr     error
	)
	for attempt := 1; attempt <= source.RetryAttempts(); attempt++ {
		run.AttemptCount = attempt
		s.emit("ingestion.fetch.started", map[string]any{"run_id": run.ID, "source_id": source.ID, "attempt": attempt})
		fetchResult, lastErr = connector.Fetch(ctx, source)
		if lastErr == nil {
			break
		}

		diagnostics["last_fetch_error"] = lastErr.Error()
		diagnostics["attempt_count"] = attempt
		if attempt < source.RetryAttempts() {
			if err := sleepContext(ctx, source.RetryBackoff()*time.Duration(attempt)); err != nil {
				return s.failRun(ctx, source, run, "fetch", err, diagnostics)
			}
		}
	}
	if lastErr != nil {
		return s.failRun(ctx, source, run, "fetch", lastErr, diagnostics)
	}
	diagnostics["attempt_count"] = run.AttemptCount
	diagnostics["fetched_at"] = fetchResult.FetchedAt.UTC().Format(time.RFC3339Nano)
	diagnostics["content_type"] = fetchResult.ContentType
	diagnostics["payload_bytes"] = len(fetchResult.Payload)
	s.emit("ingestion.fetch.completed", map[string]any{"run_id": run.ID, "source_id": source.ID, "attempt": run.AttemptCount, "payload_bytes": len(fetchResult.Payload)})

	candidates, err := connector.Parse(ctx, source, fetchResult.Payload)
	if err != nil {
		diagnostics["payload_excerpt"] = excerpt(fetchResult.Payload, 512)
		return s.failRun(ctx, source, run, "parse", err, diagnostics)
	}
	diagnostics["parsed_items"] = len(candidates)
	s.emit("ingestion.parse.completed", map[string]any{"run_id": run.ID, "source_id": source.ID, "item_count": len(candidates)})

	artifactKey, checksum := artifactLocation(source.ID, fetchResult.Payload, fetchResult.ContentType)
	storedObject, err := s.artifacts.Put(ctx, objectstore.PutInput{
		Key:         artifactKey,
		ContentType: fetchResult.ContentType,
		Body:        fetchResult.Payload,
	})
	if err != nil {
		return s.failRun(ctx, source, run, "artifact_store", err, diagnostics)
	}

	if err := s.store.RecordArtifact(ctx, domain.Artifact{
		Key:         storedObject.Key,
		SourceID:    source.ID,
		RunID:       run.ID,
		Kind:        "raw-source-payload",
		ContentType: fetchResult.ContentType,
		Checksum:    checksum,
		ByteSize:    storedObject.Size,
		CreatedAt:   fetchResult.FetchedAt.UTC(),
	}); err != nil {
		return s.failRun(ctx, source, run, "artifact_record", err, diagnostics)
	}
	diagnostics["artifact_key"] = storedObject.Key
	diagnostics["artifact_checksum"] = checksum

	changes, err := s.store.ReplaceObservedListings(ctx, source.ID, fetchResult.FetchedAt.UTC(), candidates)
	if err != nil {
		return s.failRun(ctx, source, run, "reconcile", err, diagnostics)
	}
	diagnostics["change_count"] = len(changes)
	s.emit("ingestion.reconcile.completed", map[string]any{"run_id": run.ID, "source_id": source.ID, "change_count": len(changes)})

	notificationsCreated := 0
	if s.changes != nil {
		notificationsCreated, err = s.changes.ProcessIngestionChanges(ctx, changes)
		if err != nil {
			s.logger.Error("process ingestion changes", "run_id", run.ID, "error", err.Error())
			diagnostics["notification_error"] = err.Error()
		}
	}
	diagnostics["notifications_created"] = notificationsCreated

	finishedAt := s.clock.Now().UTC()
	nextScheduledAt := nextRunAt(finishedAt, source.ScheduleInterval())
	if err := s.store.UpdateSourceRunState(ctx, source.ID, &finishedAt, nextScheduledAt); err != nil {
		return domain.Run{}, err
	}

	diagnosticsJSON, err := json.Marshal(diagnostics)
	if err != nil {
		return domain.Run{}, err
	}
	if err := s.store.CompleteRun(ctx, run.ID, finishedAt, len(candidates), storedObject.Key, run.AttemptCount, diagnosticsJSON); err != nil {
		return domain.Run{}, err
	}

	run.Status = domain.RunStatusCompleted
	run.Diagnostics = diagnosticsJSON
	run.ItemCount = len(candidates)
	run.ArtifactKey = storedObject.Key
	run.FinishedAt = &finishedAt

	s.logger.Info("ingestion completed",
		"run_id", run.ID,
		"correlation_id", run.CorrelationID,
		"source_id", source.ID,
		"item_count", len(candidates),
		"artifact_key", storedObject.Key,
	)
	s.emit("ingestion.run.completed", map[string]any{"run_id": run.ID, "source_id": source.ID, "item_count": len(candidates), "notifications_created": notificationsCreated})

	return run, nil
}

// RunDueSources executes all due scheduled sources up to the supplied limit.
func (s *Service) RunDueSources(ctx context.Context, limit int) error {
	if limit <= 0 {
		limit = 10
	}

	now := s.clock.Now().UTC()
	sources, err := s.store.ListDueSources(ctx, now, limit)
	if err != nil {
		return err
	}

	for _, source := range sources {
		if source.FreshnessWindow() > 0 && source.LastRunAt != nil && now.Sub(*source.LastRunAt) < source.FreshnessWindow() {
			next := nextRunAt(now, source.ScheduleInterval())
			if err := s.store.UpdateSourceRunState(ctx, source.ID, source.LastRunAt, next); err != nil {
				return err
			}
			continue
		}

		if _, err := s.IngestSource(ctx, source.ID, IngestOptions{TriggerKind: domain.TriggerKindScheduled}); err != nil {
			switch {
			case errors.Is(err, ErrSourceLocked):
				continue
			case errors.Is(err, ErrSourceRateLimited):
				next := nextRunAt(now.Add(source.RateLimitWindow()), source.ScheduleInterval())
				if next == nil {
					next = nextRunAt(now, source.ScheduleInterval())
				}
				if updateErr := s.store.UpdateSourceRunState(ctx, source.ID, source.LastRunAt, next); updateErr != nil {
					return updateErr
				}
			default:
				s.logger.Error("scheduled ingest failed", "source_id", source.ID, "error", err.Error())
			}
		}
	}

	return nil
}

func (s *Service) failRun(ctx context.Context, source domain.Source, run domain.Run, stage string, cause error, diagnostics map[string]any) (domain.Run, error) {
	finishedAt := s.clock.Now().UTC()
	message := cause.Error()
	diagnostics["stage"] = stage
	diagnostics["failed_at"] = finishedAt.Format(time.RFC3339Nano)
	diagnostics["error"] = message

	failureDiagnostics, _ := json.Marshal(diagnostics)
	failureArtifactKey := ""
	storedObject, err := s.artifacts.Put(ctx, objectstore.PutInput{
		Key:         path.Join("diagnostics", source.ID, run.ID+".json"),
		ContentType: "application/json",
		Body:        failureDiagnostics,
	})
	if err == nil {
		failureArtifactKey = storedObject.Key
	}

	if err := s.store.UpdateSourceRunState(ctx, source.ID, &finishedAt, nextRunAt(finishedAt, source.ScheduleInterval())); err != nil {
		return domain.Run{}, err
	}

	if err := s.store.FailRun(ctx, run.ID, finishedAt, message, failureArtifactKey, maxInt(run.AttemptCount, 1), failureDiagnostics); err != nil {
		return domain.Run{}, fmt.Errorf("mark run failed: %w (original error: %v)", err, cause)
	}

	run.Status = domain.RunStatusFailed
	run.Diagnostics = failureDiagnostics
	run.ErrorMessage = message
	run.FailureArtifactKey = failureArtifactKey
	run.FinishedAt = &finishedAt

	s.logger.Error("ingestion failed",
		"run_id", run.ID,
		"correlation_id", run.CorrelationID,
		"source_id", run.SourceID,
		"stage", stage,
		"error", message,
	)
	s.emit("ingestion.run.failed", map[string]any{"run_id": run.ID, "source_id": run.SourceID, "stage": stage, "error": message})

	return run, cause
}

func artifactLocation(sourceID string, payload []byte, contentType string) (string, string) {
	sum := sha256.Sum256(payload)
	checksum := hex.EncodeToString(sum[:])
	extension := ".bin"

	switch {
	case strings.Contains(contentType, "json"):
		extension = ".json"
	case strings.Contains(contentType, "html"):
		extension = ".html"
	}

	return path.Join("raw", sourceID, checksum+extension), checksum
}

func nextRunAt(base time.Time, interval time.Duration) *time.Time {
	if interval <= 0 {
		return nil
	}

	next := base.Add(interval)
	return &next
}

func sleepContext(ctx context.Context, duration time.Duration) error {
	timer := time.NewTimer(duration)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func excerpt(payload []byte, limit int) string {
	if limit <= 0 || len(payload) <= limit {
		return string(payload)
	}

	return string(payload[:limit])
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}

	return b
}

func (s *Service) emit(eventType string, data any) {
	if s.events == nil {
		return
	}

	s.events.Publish(eventType, data)
}

type systemClock struct{}

func (systemClock) Now() time.Time {
	return time.Now()
}
