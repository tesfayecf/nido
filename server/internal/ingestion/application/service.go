/**
 * File: internal/ingestion/application/service.go
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
 * - crypto/sha256
 * - database/sql
 * - encoding/hex
 * - encoding/json
 * - errors
 * - fmt
 * - log/slog
 * - path
 * - strings
 * - time
 * - nido/server/internal/engine
 * - nido/server/internal/ingestion/domain
 * - nido/server/internal/platform/id
 * - nido/server/internal/platform/objectstore
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
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"path"
	"strings"
	"time"

	"nido/server/internal/engine"
	"nido/server/internal/ingestion/domain"
	"nido/server/internal/platform/id"
	"nido/server/internal/platform/objectstore"
)

// ErrSourceNotFound indicates that the requested source does not exist.
var ErrSourceNotFound = errors.New("source not found")

// ErrRunNotFound indicates that the requested run does not exist.
var ErrRunNotFound = errors.New("run not found")

// ErrSourceLocked indicates that another ingest is already running for a source.
var ErrSourceLocked = errors.New("source is already being ingested")

// ErrSourceRateLimited indicates that source rate limits would be exceeded.
var ErrSourceRateLimited = errors.New("source rate limit exceeded")

/**
 * Purpose:
 * Defines the Connector interface used by this package and its consumers.
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
type Connector interface {
	Kind() string
	Fetch(ctx context.Context, source domain.Source) (FetchResult, error)
	Parse(ctx context.Context, source domain.Source, payload []byte) ([]domain.CandidateListing, error)
}

/**
 * Purpose:
 * Defines the SourceValidator interface used by this package and its consumers.
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
type SourceValidator interface {
	ValidateSource(source domain.Source) error
}

/**
 * Purpose:
 * Defines the Store interface used by this package and its consumers.
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
type Store interface {
	UpsertSource(ctx context.Context, source domain.Source) error
	ListSources(ctx context.Context) ([]domain.Source, error)
	ListDueSources(ctx context.Context, before time.Time, limit int) ([]domain.Source, error)
	GetSource(ctx context.Context, sourceID string) (domain.Source, error)
	DeleteSource(ctx context.Context, sourceID string) error
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

/**
 * Purpose:
 * Defines the FetchResult struct used by this package and its consumers.
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
type FetchResult struct {
	Payload     []byte
	ContentType string
	FetchedAt   time.Time
	Domain      string
	Proxy       string
	Latency     time.Duration
	ByteCount   int
}

/**
 * Purpose:
 * Defines the Clock interface used by this package and its consumers.
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
type Clock interface {
	Now() time.Time
}

/**
 * Purpose:
 * Defines the ChangeProcessor interface used by this package and its consumers.
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
type ChangeProcessor interface {
	ProcessIngestionChanges(ctx context.Context, changes []domain.ListingChange) (int, error)
}

/**
 * Purpose:
 * Defines the Publisher interface used by this package and its consumers.
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
type Publisher interface {
	Publish(eventType string, data any)
}

/**
 * Purpose:
 * Defines the IngestOptions struct used by this package and its consumers.
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
type IngestOptions struct {
	TriggerKind string
	Force       bool
}

/**
 * Purpose:
 * Defines the Service struct used by this package and its consumers.
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
type Service struct {
	logger     *slog.Logger
	store      Store
	artifacts  objectstore.Store
	connectors map[string]Connector
	clock      Clock
	lockTTL    time.Duration
	retryer    *engine.Retryer
	changes    ChangeProcessor
	events     Publisher
}

/**
 * Purpose:
 * Performs the NewService operation for this backend package.
 *
 * Parameters:
 * - logger *slog.Logger, store Store, artifacts objectstore.Store, connectors []Connector, clock Clock, lockTTL time.Duration, changes ChangeProcessor, events Publisher
 *
 * Returns:
 * - (*Service, error)
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
		retryer:    engine.NewRetryer(0),
		changes:    changes,
		events:     events,
	}, nil
}

/**
 * Purpose:
 * Performs the EnsureSource operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - EnsureSource(ctx context.Context, source domain.Source) (domain.Source, error)
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

/**
 * Purpose:
 * Performs the ListSources operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - ListSources(ctx context.Context) ([]domain.Source, error)
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
func (s *Service) ListSources(ctx context.Context) ([]domain.Source, error) {
	return s.store.ListSources(ctx)
}

/**
 * Purpose:
 * Performs the ListRuns operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - ListRuns(ctx context.Context, sourceID string, limit int) ([]domain.Run, error)
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
func (s *Service) ListRuns(ctx context.Context, sourceID string, limit int) ([]domain.Run, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	return s.store.ListRuns(ctx, sourceID, limit)
}

/**
 * Purpose:
 * Performs the GetRun operation for this backend package.
 *
 * Parameters:
 * - s *Service
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
func (s *Service) GetRun(ctx context.Context, runID string) (domain.Run, error) {
	run, err := s.store.GetRun(ctx, runID)
	if err != nil {
		return domain.Run{}, mapLookupError(err, ErrRunNotFound)
	}

	return run, nil
}

/**
 * Purpose:
 * Performs the GetSource operation for this backend package.
 *
 * Parameters:
 * - s *Service
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
func (s *Service) GetSource(ctx context.Context, sourceID string) (domain.Source, error) {
	source, err := s.store.GetSource(ctx, sourceID)
	if err != nil {
		return domain.Source{}, mapLookupError(err, ErrSourceNotFound)
	}

	return source, nil
}

/**
 * Purpose:
 * Performs the DeleteSource operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - DeleteSource(ctx context.Context, sourceID string) error
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
func (s *Service) DeleteSource(ctx context.Context, sourceID string) error {
	err := s.store.DeleteSource(ctx, sourceID)
	if err != nil {
		return mapLookupError(err, ErrSourceNotFound)
	}

	return nil
}

/**
 * Purpose:
 * Performs the normalizeSourceForUpsert operation for this backend package.
 *
 * Parameters:
 * - source domain.Source, now time.Time
 *
 * Returns:
 * - domain.Source
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
func normalizeSourceForUpsert(source domain.Source, now time.Time) domain.Source {
	source.ID = strings.TrimSpace(source.ID)
	source.Name = strings.TrimSpace(source.Name)
	source.Kind = strings.TrimSpace(source.Kind)
	source.EndpointURL = strings.TrimSpace(source.EndpointURL)
	if source.Kind == "" {
		source.Kind = "property-template"
	}
	source.ConfigJSON = strings.TrimSpace(source.ConfigJSON)
	if strings.TrimSpace(source.ConfigJSON) == "" {
		source.ConfigJSON = "[]"
	}
	source.Active = true
	if source.CreatedAt.IsZero() {
		source.CreatedAt = now
	}
	if source.UpdatedAt.IsZero() {
		source.UpdatedAt = now
	}

	return source
}

/**
 * Purpose:
 * Performs the normalizeAndValidateSource operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - normalizeAndValidateSource(source domain.Source) (domain.Source, error)
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
func (s *Service) normalizeAndValidateSource(source domain.Source) (domain.Source, error) {
	normalized := normalizeSourceForUpsert(source, s.clock.Now().UTC())
	if normalized.ID == "" {
		return domain.Source{}, fmt.Errorf("source id is required")
	}
	if normalized.Name == "" {
		return domain.Source{}, fmt.Errorf("source name is required")
	}
	if !json.Valid([]byte(normalized.ConfigJSON)) {
		return domain.Source{}, fmt.Errorf("source config must be valid json")
	}

	return normalized, nil
}

/**
 * Purpose:
 * Performs the mapLookupError operation for this backend package.
 *
 * Parameters:
 * - err error, notFound error
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
func mapLookupError(err error, notFound error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return notFound
	}

	return err
}

/**
 * Purpose:
 * Performs the IngestSource operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - IngestSource(ctx context.Context, sourceID string, options IngestOptions) (domain.Run, error)
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
		diagnostics["failure_class"] = failureClass(lastErr)
		if attempt < source.RetryAttempts() && engine.IsRetryable(lastErr) {
			if err := s.retryer.Sleep(ctx, source.RetryBackoff(), attempt); err != nil {
				return s.failRun(ctx, source, run, "fetch", err, diagnostics)
			}
			continue
		}

		break
	}
	if lastErr != nil {
		return s.failRun(ctx, source, run, "fetch", lastErr, diagnostics)
	}
	diagnostics["attempt_count"] = run.AttemptCount
	diagnostics["fetched_at"] = fetchResult.FetchedAt.UTC().Format(time.RFC3339Nano)
	diagnostics["content_type"] = fetchResult.ContentType
	diagnostics["payload_bytes"] = len(fetchResult.Payload)
	diagnostics["domain"] = fetchResult.Domain
	diagnostics["proxy_provider"] = fetchResult.Proxy
	diagnostics["bytes_processed"] = fetchResult.ByteCount
	diagnostics["latency_ms"] = fetchResult.Latency.Milliseconds()
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

/**
 * Purpose:
 * Performs the RunDueSources operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - RunDueSources(ctx context.Context, limit int) error
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
func (s *Service) RunDueSources(ctx context.Context, limit int) error {
	sources, now, err := s.dueSources(ctx, limit)
	if err != nil {
		return err
	}

	for _, source := range sources {
		if err := s.runDueSource(ctx, source, now); err != nil {
			return err
		}
	}

	return nil
}

/**
 * Purpose:
 * Performs the dueSources operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - dueSources(ctx context.Context, limit int) ([]domain.Source, time.Time, error)
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
func (s *Service) dueSources(ctx context.Context, limit int) ([]domain.Source, time.Time, error) {
	if limit <= 0 {
		limit = 10
	}

	now := s.clock.Now().UTC()
	sources, err := s.store.ListDueSources(ctx, now, limit)
	if err != nil {
		return nil, time.Time{}, err
	}

	return sources, now, nil
}

/**
 * Purpose:
 * Performs the runDueSource operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - runDueSource(ctx context.Context, source domain.Source, now time.Time) error
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
func (s *Service) runDueSource(ctx context.Context, source domain.Source, now time.Time) error {
	if source.FreshnessWindow() > 0 && source.LastRunAt != nil && now.Sub(*source.LastRunAt) < source.FreshnessWindow() {
		next := nextRunAt(now, source.ScheduleInterval())
		return s.store.UpdateSourceRunState(ctx, source.ID, source.LastRunAt, next)
	}

	if _, err := s.IngestSource(ctx, source.ID, IngestOptions{TriggerKind: domain.TriggerKindScheduled}); err != nil {
		switch {
		case errors.Is(err, ErrSourceLocked):
			return nil
		case errors.Is(err, ErrSourceRateLimited):
			next := nextRunAt(now.Add(source.RateLimitWindow()), source.ScheduleInterval())
			if next == nil {
				next = nextRunAt(now, source.ScheduleInterval())
			}
			return s.store.UpdateSourceRunState(ctx, source.ID, source.LastRunAt, next)
		default:
			s.logger.Error("scheduled ingest failed", "source_id", source.ID, "error", err.Error())
		}
	}

	return nil
}

/**
 * Purpose:
 * Performs the failRun operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - failRun(ctx context.Context, source domain.Source, run domain.Run, stage string, cause error, diagnostics map[string]any) (domain.Run, error)
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

/**
 * Purpose:
 * Performs the artifactLocation operation for this backend package.
 *
 * Parameters:
 * - sourceID string, payload []byte, contentType string
 *
 * Returns:
 * - (string, string)
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

/**
 * Purpose:
 * Performs the nextRunAt operation for this backend package.
 *
 * Parameters:
 * - base time.Time, interval time.Duration
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
func nextRunAt(base time.Time, interval time.Duration) *time.Time {
	if interval <= 0 {
		return nil
	}

	next := base.Add(interval)
	return &next
}

/**
 * Purpose:
 * Performs the failureClass operation for this backend package.
 *
 * Parameters:
 * - err error
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
func failureClass(err error) string {
	var classified interface{ FailureClass() engine.FailureClass }
	if errors.As(err, &classified) {
		return string(classified.FailureClass())
	}

	return string(engine.FailureFatal)
}

/**
 * Purpose:
 * Performs the excerpt operation for this backend package.
 *
 * Parameters:
 * - payload []byte, limit int
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
func excerpt(payload []byte, limit int) string {
	if limit <= 0 || len(payload) <= limit {
		return string(payload)
	}

	return string(payload[:limit])
}

/**
 * Purpose:
 * Performs the maxInt operation for this backend package.
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
func maxInt(a, b int) int {
	if a > b {
		return a
	}

	return b
}

/**
 * Purpose:
 * Performs the emit operation for this backend package.
 *
 * Parameters:
 * - s *Service
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
func (s *Service) emit(eventType string, data any) {
	if s.events == nil {
		return
	}

	s.events.Publish(eventType, data)
}

/**
 * Purpose:
 * Defines the systemClock struct used by this package and its consumers.
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
type systemClock struct{}

/**
 * Purpose:
 * Performs the Now operation for this backend package.
 *
 * Parameters:
 * - systemClock
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
func (systemClock) Now() time.Time {
	return time.Now()
}
