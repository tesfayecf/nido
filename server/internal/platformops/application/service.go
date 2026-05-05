/**
 * File: internal/platformops/application/service.go
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
 * - encoding/json
 * - fmt
 * - log/slog
 * - net/http
 * - net/smtp
 * - net/url
 * - os
 * - path/filepath
 * - regexp
 * - strings
 * - time
 * - nido/server/internal/ingestion/application
 * - nido/server/internal/platform/config
 * - nido/server/internal/platform/events
 * - nido/server/internal/platform/id
 * - nido/server/internal/platformops/domain
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
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/smtp"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	ingestionapp "nido/server/internal/ingestion/application"
	platformconfig "nido/server/internal/platform/config"
	platformevents "nido/server/internal/platform/events"
	"nido/server/internal/platform/id"
	platformopsdomain "nido/server/internal/platformops/domain"
)

/**
 * @critical
 * Description: Workspace restore and reset operations intentionally replace or remove persisted workspace state.
 * Why critical: Operator mistakes or malformed backup payloads can cause irreversible data loss without a valid backup.
 * What can break: Sources, properties, snapshots, fields, tags, engagement records, settings, and delivery logs.
 * Failure conditions: Concurrent writes during restore, invalid backup normalization, missing pre-operation backup, or unauthorized access.
 */

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
	ExportWorkspaceBackup(ctx context.Context) (platformopsdomain.WorkspaceBackup, error)
	RestoreWorkspaceBackup(ctx context.Context, backup platformopsdomain.WorkspaceBackup) error
	ResetWorkspace(ctx context.Context) error
	GetPlatformSettings(ctx context.Context) (platformopsdomain.PlatformSettings, error)
	SavePlatformSettings(ctx context.Context, settings platformopsdomain.PlatformSettings) error
	CreateIntegrationDeliveryLog(ctx context.Context, log platformopsdomain.IntegrationDeliveryLog) error
	ListIntegrationDeliveryLogs(ctx context.Context, limit int) ([]platformopsdomain.IntegrationDeliveryLog, error)
	CountProperties(ctx context.Context) (int, error)
	CountPausedProperties(ctx context.Context) (int, error)
	CountDueProperties(ctx context.Context, before time.Time) (int, error)
	CountPropertyRunsSince(ctx context.Context, since time.Time) (int, int, error)
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
	events     *platformevents.Broker
	scheduler  *ingestionapp.PropertyScheduler
	cfg        platformconfig.NotificationsConfig
	backupDir  string
	httpClient *http.Client

	digestCtx    context.Context
	digestCancel context.CancelFunc
}

const weeklyDigestInterval = 7 * 24 * time.Hour

var backupFileNamePattern = regexp.MustCompile(`^[A-Za-z0-9._-]+$`)

/**
 * Purpose:
 * Performs the NewService operation for this backend package.
 *
 * Parameters:
 * - logger *slog.Logger, store Store, events *platformevents.Broker, scheduler *ingestionapp.PropertyScheduler, cfg platformconfig.NotificationsConfig, backupDir string
 *
 * Returns:
 * - *Service
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
func NewService(logger *slog.Logger, store Store, events *platformevents.Broker, scheduler *ingestionapp.PropertyScheduler, cfg platformconfig.NotificationsConfig, backupDir string) *Service {
	digestCtx, digestCancel := context.WithCancel(context.Background())
	return &Service{
		logger:       logger,
		store:        store,
		events:       events,
		scheduler:    scheduler,
		cfg:          cfg,
		backupDir:    backupDir,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
		digestCtx:    digestCtx,
		digestCancel: digestCancel,
	}
}

/**
 * Purpose:
 * Performs the Start operation for this backend package.
 *
 * Parameters:
 * - s *Service
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
func (s *Service) Start() {
	if err := s.reconcileRuntimeState(context.Background()); err != nil && s.logger != nil {
		s.logger.Error("reconcile platform runtime state", "error", err)
	}
	if s.events != nil {
		eventStream, cancel := s.events.Subscribe(64)
		go func() {
			defer cancel()
			for {
				select {
				case <-s.digestCtx.Done():
					return
				case event, ok := <-eventStream:
					if !ok {
						return
					}
					s.handleEvent(event)
				}
			}
		}()
	}

	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-s.digestCtx.Done():
				return
			case <-ticker.C:
				if err := s.reconcileRuntimeState(context.Background()); err != nil && s.logger != nil {
					s.logger.Error("reconcile platform runtime state", "error", err)
				}
				if err := s.maybeSendDigest(context.Background()); err != nil && s.logger != nil {
					s.logger.Error("send email digest", "error", err)
				}
			}
		}
	}()
}

/**
 * Purpose:
 * Performs the Stop operation for this backend package.
 *
 * Parameters:
 * - s *Service
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
func (s *Service) Stop() {
	if s.digestCancel != nil {
		s.digestCancel()
	}
}

/**
 * Purpose:
 * Performs the GetSettings operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - GetSettings(ctx context.Context) (platformopsdomain.PlatformSettings, error)
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
func (s *Service) GetSettings(ctx context.Context) (platformopsdomain.PlatformSettings, error) {
	settings, err := s.store.GetPlatformSettings(ctx)
	if err != nil {
		return platformopsdomain.PlatformSettings{}, err
	}
	if strings.TrimSpace(settings.Webhook.URL) == "" && strings.TrimSpace(s.cfg.WebhookURL) != "" {
		settings.Webhook.URL = strings.TrimSpace(s.cfg.WebhookURL)
	}
	return settings, nil
}

/**
 * Purpose:
 * Performs the UpdateSettings operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - UpdateSettings(ctx context.Context, settings platformopsdomain.PlatformSettings) (platformopsdomain.PlatformSettings, error)
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
func (s *Service) UpdateSettings(ctx context.Context, settings platformopsdomain.PlatformSettings) (platformopsdomain.PlatformSettings, error) {
	existing, err := s.GetSettings(ctx)
	if err != nil {
		return platformopsdomain.PlatformSettings{}, err
	}
	if settings.ID == "" {
		settings.ID = existing.ID
	}
	if settings.EmailDigest.Schedule == "" {
		settings.EmailDigest.Schedule = existing.EmailDigest.Schedule
	}
	if err := s.store.SavePlatformSettings(ctx, settings); err != nil {
		return platformopsdomain.PlatformSettings{}, err
	}
	if err := s.reconcileRuntimeState(ctx); err != nil {
		return platformopsdomain.PlatformSettings{}, err
	}
	return s.GetSettings(ctx)
}

/**
 * Purpose:
 * Performs the ExportWorkspaceBackup operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - ExportWorkspaceBackup(ctx context.Context) (platformopsdomain.WorkspaceBackup, error)
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
func (s *Service) ExportWorkspaceBackup(ctx context.Context) (platformopsdomain.WorkspaceBackup, error) {
	return s.store.ExportWorkspaceBackup(ctx)
}

/**
 * Purpose:
 * Performs the RestoreWorkspaceBackup operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - RestoreWorkspaceBackup(ctx context.Context, backup platformopsdomain.WorkspaceBackup) error
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
func (s *Service) RestoreWorkspaceBackup(ctx context.Context, backup platformopsdomain.WorkspaceBackup) error {
	if err := s.store.RestoreWorkspaceBackup(ctx, backup); err != nil {
		return err
	}
	return s.reconcileRuntimeState(ctx)
}

/**
 * Purpose:
 * Performs the CreateWorkspaceBackupFile operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - CreateWorkspaceBackupFile(ctx context.Context) (platformopsdomain.BackupFileInfo, error)
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
func (s *Service) CreateWorkspaceBackupFile(ctx context.Context) (platformopsdomain.BackupFileInfo, error) {
	backup, err := s.ExportWorkspaceBackup(ctx)
	if err != nil {
		return platformopsdomain.BackupFileInfo{}, err
	}
	if err := os.MkdirAll(s.backupDir, 0o755); err != nil {
		return platformopsdomain.BackupFileInfo{}, fmt.Errorf("create backup directory: %w", err)
	}
	timestamp := time.Now().UTC().Format("2006-01-02T15-04-05")
	name := fmt.Sprintf("workspace_%s_v%d.json", timestamp, backup.SchemaVersion)
	path := filepath.Join(s.backupDir, name)
	payload, err := json.MarshalIndent(backup, "", "  ")
	if err != nil {
		return platformopsdomain.BackupFileInfo{}, fmt.Errorf("marshal workspace backup: %w", err)
	}
	if err := os.WriteFile(path, payload, 0o600); err != nil {
		return platformopsdomain.BackupFileInfo{}, fmt.Errorf("write workspace backup file: %w", err)
	}
	return backupFileInfo(path)
}

/**
 * Purpose:
 * Performs the ListWorkspaceBackupFiles operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - ListWorkspaceBackupFiles() ([]platformopsdomain.BackupFileInfo, error)
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
func (s *Service) ListWorkspaceBackupFiles() ([]platformopsdomain.BackupFileInfo, error) {
	entries, err := os.ReadDir(s.backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []platformopsdomain.BackupFileInfo{}, nil
		}
		return nil, fmt.Errorf("list backup directory: %w", err)
	}
	items := make([]platformopsdomain.BackupFileInfo, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		item, err := backupFileInfo(filepath.Join(s.backupDir, entry.Name()))
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

/**
 * Purpose:
 * Performs the BackupFilePath operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - BackupFilePath(name string) (string, error)
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
func (s *Service) BackupFilePath(name string) (string, error) {
	trimmed := strings.TrimSpace(name)
	base := filepath.Base(filepath.Clean(trimmed))
	if base == "." || base == "" || base != trimmed || !backupFileNamePattern.MatchString(base) {
		return "", fmt.Errorf("invalid backup file name")
	}
	path := filepath.Join(s.backupDir, base)
	if _, err := os.Stat(path); err != nil {
		return "", fmt.Errorf("backup file not found: %w", err)
	}
	return path, nil
}

/**
 * Purpose:
 * Performs the ResetWorkspace operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - ResetWorkspace(ctx context.Context) error
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
func (s *Service) ResetWorkspace(ctx context.Context) error {
	if err := s.store.ResetWorkspace(ctx); err != nil {
		return err
	}
	return s.reconcileRuntimeState(ctx)
}

/**
 * Purpose:
 * Performs the Summary operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - Summary(ctx context.Context) (platformopsdomain.SchedulerSummary, error)
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
func (s *Service) Summary(ctx context.Context) (platformopsdomain.SchedulerSummary, error) {
	settings, err := s.GetSettings(ctx)
	if err != nil {
		return platformopsdomain.SchedulerSummary{}, err
	}
	now := time.Now().UTC()
	due, err := s.store.CountDueProperties(ctx, now)
	if err != nil {
		return platformopsdomain.SchedulerSummary{}, err
	}
	tracked, err := s.store.CountProperties(ctx)
	if err != nil {
		return platformopsdomain.SchedulerSummary{}, err
	}
	paused, err := s.store.CountPausedProperties(ctx)
	if err != nil {
		return platformopsdomain.SchedulerSummary{}, err
	}
	runsLast24Hours, failuresLast24Hours, err := s.store.CountPropertyRunsSince(ctx, now.Add(-24*time.Hour))
	if err != nil {
		return platformopsdomain.SchedulerSummary{}, err
	}
	runningCount := 0
	schedulerEnabled := settings.SchedulerEnabled
	if s.scheduler != nil {
		runningCount = s.scheduler.RunningCount()
		schedulerEnabled = s.scheduler.Enabled()
	}
	successRate := 100.0
	if runsLast24Hours > 0 {
		successRate = float64(runsLast24Hours-failuresLast24Hours) / float64(runsLast24Hours) * 100
	}
	return platformopsdomain.SchedulerSummary{
		SchedulerEnabled:         schedulerEnabled,
		MaintenanceWindowActive:  isWithinMaintenanceWindow(settings, now),
		MaintenanceWindowEnabled: settings.MaintenanceWindowEnabled,
		RunningProperties:        runningCount,
		DueProperties:            due,
		TrackedProperties:        tracked,
		PausedProperties:         paused,
		QueueDepth:               due + runningCount,
		RunsLast24Hours:          runsLast24Hours,
		FailuresLast24Hours:      failuresLast24Hours,
		SuccessRate:              successRate,
		LastUpdatedAt:            now,
	}, nil
}

/**
 * Purpose:
 * Performs the ListDeliveryLogs operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - ListDeliveryLogs(ctx context.Context, limit int) ([]platformopsdomain.IntegrationDeliveryLog, error)
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
func (s *Service) ListDeliveryLogs(ctx context.Context, limit int) ([]platformopsdomain.IntegrationDeliveryLog, error) {
	return s.store.ListIntegrationDeliveryLogs(ctx, limit)
}

/**
 * Purpose:
 * Performs the TestChannel operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - TestChannel(ctx context.Context, channel string) error
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
func (s *Service) TestChannel(ctx context.Context, channel string) error {
	payload := map[string]any{
		"message": "nido integration test",
		"sent_at": time.Now().UTC(),
		"channel": channel,
	}
	return s.deliver(ctx, channel, "integration.test", payload)
}

/**
 * Purpose:
 * Performs the reconcileRuntimeState operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - reconcileRuntimeState(ctx context.Context) error
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
func (s *Service) reconcileRuntimeState(ctx context.Context) error {
	settings, err := s.GetSettings(ctx)
	if err != nil {
		return err
	}
	enabled := settings.SchedulerEnabled && !isWithinMaintenanceWindow(settings, time.Now().UTC())
	if s.scheduler != nil {
		s.scheduler.SetEnabled(enabled)
	}
	return nil
}

/**
 * Purpose:
 * Performs the maybeSendDigest operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - maybeSendDigest(ctx context.Context) error
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
func (s *Service) maybeSendDigest(ctx context.Context) error {
	settings, err := s.GetSettings(ctx)
	if err != nil {
		return err
	}
	if !settings.EmailDigest.Enabled || strings.TrimSpace(settings.EmailDigest.Recipient) == "" {
		return nil
	}
	hour, minute, ok := parseClock(settings.EmailDigest.Schedule)
	if !ok {
		return nil
	}
	now := time.Now().UTC()
	windowStart := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, time.UTC)
	if now.Before(windowStart) {
		return nil
	}
	if settings.EmailDigest.LastSentAt != nil && now.Sub(settings.EmailDigest.LastSentAt.UTC()) < weeklyDigestInterval {
		return nil
	}

	summary, err := s.Summary(ctx)
	if err != nil {
		return err
	}
	body := fmt.Sprintf(
		"Nido weekly digest\n\nTracked properties: %d\nPaused properties: %d\nQueue depth: %d\nRuns last 24h: %d\nFailures last 24h: %d\nSuccess rate: %.1f%%\n",
		summary.TrackedProperties,
		summary.PausedProperties,
		summary.QueueDepth,
		summary.RunsLast24Hours,
		summary.FailuresLast24Hours,
		summary.SuccessRate,
	)
	if err := s.sendEmailDigest(settings.EmailDigest.Recipient, "Nido weekly digest", body); err != nil {
		return s.persistLog(ctx, platformopsdomain.IntegrationDeliveryLog{
			ID:           id.New("idel"),
			Channel:      "email",
			EventType:    "digest",
			Target:       settings.EmailDigest.Recipient,
			Status:       "failed",
			AttemptCount: 1,
			ErrorMessage: err.Error(),
			CreatedAt:    now,
		})
	}
	settings.EmailDigest.LastSentAt = &now
	if _, err := s.UpdateSettings(ctx, settings); err != nil {
		return err
	}
	return s.persistLog(ctx, platformopsdomain.IntegrationDeliveryLog{
		ID:           id.New("idel"),
		Channel:      "email",
		EventType:    "digest",
		Target:       settings.EmailDigest.Recipient,
		Status:       "delivered",
		AttemptCount: 1,
		Payload:      mustJSON(body),
		DeliveredAt:  &now,
		CreatedAt:    now,
	})
}

/**
 * Purpose:
 * Performs the handleEvent operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - handleEvent(event platformevents.Event)
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
func (s *Service) handleEvent(event platformevents.Event) {
	if err := s.deliver(context.Background(), "webhook", event.Type, event); err != nil && s.logger != nil {
		s.logger.Warn("deliver webhook event", "event_type", event.Type, "error", err)
	}
	if err := s.deliver(context.Background(), "slack", event.Type, event); err != nil && s.logger != nil {
		s.logger.Warn("deliver slack event", "event_type", event.Type, "error", err)
	}
	if err := s.deliver(context.Background(), "spreadsheet", event.Type, event); err != nil && s.logger != nil {
		s.logger.Warn("deliver spreadsheet event", "event_type", event.Type, "error", err)
	}
	if err := s.deliver(context.Background(), "task", event.Type, event); err != nil && s.logger != nil {
		s.logger.Warn("deliver task event", "event_type", event.Type, "error", err)
	}
}

/**
 * Purpose:
 * Performs the deliver operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - deliver(ctx context.Context, channel string, eventType string, payload any) error
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
func (s *Service) deliver(ctx context.Context, channel string, eventType string, payload any) error {
	settings, err := s.GetSettings(ctx)
	if err != nil {
		return err
	}

	target := ""
	enabledEvents := []string(nil)
	switch channel {
	case "webhook":
		target = settings.Webhook.URL
		enabledEvents = settings.Webhook.Events
	case "slack":
		target = settings.Slack.URL
		enabledEvents = settings.Slack.Events
	case "spreadsheet":
		target = settings.Spreadsheet.URL
		enabledEvents = settings.Spreadsheet.Events
	case "task":
		target = settings.TaskSystem.URL
		enabledEvents = settings.TaskSystem.Events
	default:
		return fmt.Errorf("unsupported channel %q", channel)
	}
	if strings.TrimSpace(target) == "" || !eventEnabled(eventType, enabledEvents) {
		return nil
	}
	requestBody, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	delivery := platformopsdomain.IntegrationDeliveryLog{
		ID:           id.New("idel"),
		Channel:      channel,
		EventType:    eventType,
		Target:       target,
		AttemptCount: 1,
		Payload:      requestBody,
		CreatedAt:    time.Now().UTC(),
	}
	var lastErr error
	var responseStatus int
	for attempt := 1; attempt <= 3; attempt++ {
		delivery.AttemptCount = attempt
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, target, bytes.NewReader(requestBody))
		if err != nil {
			lastErr = err
			continue
		}
		request.Header.Set("Content-Type", "application/json")
		response, err := s.httpClient.Do(request)
		if err == nil {
			responseStatus = response.StatusCode
			response.Body.Close()
			if response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices {
				now := time.Now().UTC()
				delivery.Status = "delivered"
				delivery.ResponseStatus = responseStatus
				delivery.DeliveredAt = &now
				return s.persistLog(ctx, delivery)
			}
			err = fmt.Errorf("%s returned %d", channel, response.StatusCode)
		}
		lastErr = err
		time.Sleep(time.Duration(1<<(attempt-1)) * 250 * time.Millisecond)
	}
	delivery.Status = "failed"
	delivery.ResponseStatus = responseStatus
	if lastErr != nil {
		delivery.ErrorMessage = lastErr.Error()
	}
	return s.persistLog(ctx, delivery)
}

/**
 * Purpose:
 * Performs the persistLog operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - persistLog(ctx context.Context, item platformopsdomain.IntegrationDeliveryLog) error
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
func (s *Service) persistLog(ctx context.Context, item platformopsdomain.IntegrationDeliveryLog) error {
	if item.CreatedAt.IsZero() {
		item.CreatedAt = time.Now().UTC()
	}
	if item.Status == "" {
		item.Status = "failed"
	}
	return s.store.CreateIntegrationDeliveryLog(ctx, item)
}

/**
 * Purpose:
 * Performs the sendEmailDigest operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - sendEmailDigest(recipient string, subject string, body string) error
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
func (s *Service) sendEmailDigest(recipient string, subject string, body string) error {
	if strings.TrimSpace(s.cfg.SMTPHost) == "" || strings.TrimSpace(s.cfg.SMTPFrom) == "" {
		return fmt.Errorf("smtp is not configured")
	}
	address := fmt.Sprintf("%s:%d", s.cfg.SMTPHost, s.cfg.SMTPPort)
	var auth smtp.Auth
	if strings.TrimSpace(s.cfg.SMTPUser) != "" {
		auth = smtp.PlainAuth("", s.cfg.SMTPUser, s.cfg.SMTPPass, s.cfg.SMTPHost)
	}
	message := []byte(fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s", recipient, subject, body))
	return smtp.SendMail(address, auth, s.cfg.SMTPFrom, []string{recipient}, message)
}

/**
 * Purpose:
 * Performs the eventEnabled operation for this backend package.
 *
 * Parameters:
 * - eventType string, enabledEvents []string
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
func eventEnabled(eventType string, enabledEvents []string) bool {
	if len(enabledEvents) == 0 {
		return false
	}
	for _, candidate := range enabledEvents {
		normalized := strings.TrimSpace(candidate)
		if normalized == "*" || normalized == eventType {
			return true
		}
		if strings.HasSuffix(normalized, ".*") && strings.HasPrefix(eventType, strings.TrimSuffix(normalized, "*")) {
			return true
		}
	}
	return false
}

/**
 * Purpose:
 * Performs the isWithinMaintenanceWindow operation for this backend package.
 *
 * Parameters:
 * - settings platformopsdomain.PlatformSettings, now time.Time
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
func isWithinMaintenanceWindow(settings platformopsdomain.PlatformSettings, now time.Time) bool {
	if !settings.MaintenanceWindowEnabled {
		return false
	}
	startHour, startMinute, ok := parseClock(settings.MaintenanceWindowStart)
	if !ok {
		return false
	}
	endHour, endMinute, ok := parseClock(settings.MaintenanceWindowEnd)
	if !ok {
		return false
	}
	start := startHour*60 + startMinute
	end := endHour*60 + endMinute
	current := now.UTC().Hour()*60 + now.UTC().Minute()
	if start == end {
		return false
	}
	if start < end {
		return current >= start && current < end
	}
	return current >= start || current < end
}

/**
 * Purpose:
 * Performs the parseClock operation for this backend package.
 *
 * Parameters:
 * - raw string
 *
 * Returns:
 * - (int, int, bool)
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
func parseClock(raw string) (int, int, bool) {
	pieces := strings.Split(strings.TrimSpace(raw), ":")
	if len(pieces) != 2 {
		return 0, 0, false
	}
	parsed, err := time.Parse("15:04", fmt.Sprintf("%s:%s", pieces[0], pieces[1]))
	if err != nil {
		return 0, 0, false
	}
	return parsed.Hour(), parsed.Minute(), true
}

/**
 * Purpose:
 * Performs the mustJSON operation for this backend package.
 *
 * Parameters:
 * - value any
 *
 * Returns:
 * - json.RawMessage
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
func mustJSON(value any) json.RawMessage {
	encoded, err := json.Marshal(value)
	if err != nil {
		return json.RawMessage(`{}`)
	}
	return encoded
}

/**
 * Purpose:
 * Performs the backupFileInfo operation for this backend package.
 *
 * Parameters:
 * - path string
 *
 * Returns:
 * - (platformopsdomain.BackupFileInfo, error)
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
func backupFileInfo(path string) (platformopsdomain.BackupFileInfo, error) {
	info, err := os.Stat(path)
	if err != nil {
		return platformopsdomain.BackupFileInfo{}, fmt.Errorf("stat backup file: %w", err)
	}
	return platformopsdomain.BackupFileInfo{
		Name:      filepath.Base(path),
		Path:      path,
		SizeBytes: info.Size(),
		CreatedAt: info.ModTime().UTC(),
	}, nil
}

/**
 * Purpose:
 * Performs the NormalizeWebhookURL operation for this backend package.
 *
 * Parameters:
 * - raw string
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
func NormalizeWebhookURL(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	parsed, err := url.ParseRequestURI(trimmed)
	if err != nil {
		return ""
	}
	return parsed.String()
}
