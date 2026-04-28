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
	"strings"
	"time"

	ingestionapp "nido/server/internal/ingestion/application"
	platformconfig "nido/server/internal/platform/config"
	platformevents "nido/server/internal/platform/events"
	"nido/server/internal/platform/id"
	platformopsdomain "nido/server/internal/platformops/domain"
)

type Store interface {
	ExportWorkspaceBackup(ctx context.Context) (platformopsdomain.WorkspaceBackup, error)
	RestoreWorkspaceBackup(ctx context.Context, backup platformopsdomain.WorkspaceBackup) error
	GetPlatformSettings(ctx context.Context) (platformopsdomain.PlatformSettings, error)
	SavePlatformSettings(ctx context.Context, settings platformopsdomain.PlatformSettings) error
	CreateIntegrationDeliveryLog(ctx context.Context, log platformopsdomain.IntegrationDeliveryLog) error
	ListIntegrationDeliveryLogs(ctx context.Context, limit int) ([]platformopsdomain.IntegrationDeliveryLog, error)
	CountProperties(ctx context.Context) (int, error)
	CountPausedProperties(ctx context.Context) (int, error)
	CountDueProperties(ctx context.Context, before time.Time) (int, error)
	CountPropertyRunsSince(ctx context.Context, since time.Time) (int, int, error)
}

type Service struct {
	logger     *slog.Logger
	store      Store
	events     *platformevents.Broker
	scheduler  *ingestionapp.PropertyScheduler
	cfg        platformconfig.NotificationsConfig
	httpClient *http.Client

	digestCtx    context.Context
	digestCancel context.CancelFunc
}

func NewService(logger *slog.Logger, store Store, events *platformevents.Broker, scheduler *ingestionapp.PropertyScheduler, cfg platformconfig.NotificationsConfig) *Service {
	digestCtx, digestCancel := context.WithCancel(context.Background())
	return &Service{
		logger:       logger,
		store:        store,
		events:       events,
		scheduler:    scheduler,
		cfg:          cfg,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
		digestCtx:    digestCtx,
		digestCancel: digestCancel,
	}
}

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

func (s *Service) Stop() {
	if s.digestCancel != nil {
		s.digestCancel()
	}
}

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

func (s *Service) ExportWorkspaceBackup(ctx context.Context) (platformopsdomain.WorkspaceBackup, error) {
	return s.store.ExportWorkspaceBackup(ctx)
}

func (s *Service) RestoreWorkspaceBackup(ctx context.Context, backup platformopsdomain.WorkspaceBackup) error {
	if err := s.store.RestoreWorkspaceBackup(ctx, backup); err != nil {
		return err
	}
	return s.reconcileRuntimeState(ctx)
}

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

func (s *Service) ListDeliveryLogs(ctx context.Context, limit int) ([]platformopsdomain.IntegrationDeliveryLog, error) {
	return s.store.ListIntegrationDeliveryLogs(ctx, limit)
}

func (s *Service) TestChannel(ctx context.Context, channel string) error {
	payload := map[string]any{
		"message": "nido integration test",
		"sent_at": time.Now().UTC(),
		"channel": channel,
	}
	return s.deliver(ctx, channel, "integration.test", payload)
}

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
	if settings.EmailDigest.LastSentAt != nil {
		last := settings.EmailDigest.LastSentAt.UTC()
		if last.Year() == now.Year() && last.YearDay() == now.YearDay() {
			return nil
		}
	}

	summary, err := s.Summary(ctx)
	if err != nil {
		return err
	}
	body := fmt.Sprintf(
		"Nido daily digest\n\nTracked properties: %d\nPaused properties: %d\nQueue depth: %d\nRuns last 24h: %d\nFailures last 24h: %d\nSuccess rate: %.1f%%\n",
		summary.TrackedProperties,
		summary.PausedProperties,
		summary.QueueDepth,
		summary.RunsLast24Hours,
		summary.FailuresLast24Hours,
		summary.SuccessRate,
	)
	if err := s.sendEmailDigest(settings.EmailDigest.Recipient, "Nido digest", body); err != nil {
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

func (s *Service) persistLog(ctx context.Context, item platformopsdomain.IntegrationDeliveryLog) error {
	if item.CreatedAt.IsZero() {
		item.CreatedAt = time.Now().UTC()
	}
	if item.Status == "" {
		item.Status = "failed"
	}
	return s.store.CreateIntegrationDeliveryLog(ctx, item)
}

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

func mustJSON(value any) json.RawMessage {
	encoded, err := json.Marshal(value)
	if err != nil {
		return json.RawMessage(`{}`)
	}
	return encoded
}

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
