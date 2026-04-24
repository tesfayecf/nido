package application

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	authdomain "home-searcher/server/internal/auth/domain"
	engagementdomain "home-searcher/server/internal/engagement/domain"
	ingestiondomain "home-searcher/server/internal/ingestion/domain"
	"home-searcher/server/internal/platform/id"
)

// WorkspaceStore defines the persistence contract for property context, analytics, and operations features.
type WorkspaceStore interface {
	GetProperty(ctx context.Context, propertyID string) (ingestiondomain.Property, error)
	ListProperties(ctx context.Context) ([]ingestiondomain.Property, error)
	UpsertProperty(ctx context.Context, property ingestiondomain.Property) error
	ListPropertyTags(ctx context.Context, propertyID string) ([]ingestiondomain.Tag, error)
	ListPropertySnapshots(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error)
	ListPropertyRuns(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertyRun, error)
	ListNotificationsForWorkspace(ctx context.Context, since time.Time) ([]engagementdomain.Notification, error)
	ListAlertRulesForWorkspace(ctx context.Context) ([]engagementdomain.AlertRule, error)
	GetPropertyMetadata(ctx context.Context, propertyID string) (ingestiondomain.PropertyMetadata, error)
	UpsertPropertyMetadata(ctx context.Context, metadata ingestiondomain.PropertyMetadata) error
	CreateNotification(ctx context.Context, notification engagementdomain.Notification) error
	CreateAuditLog(ctx context.Context, log ingestiondomain.AuditLog) error
	ListAuditLogs(ctx context.Context, targetKind, targetID string, limit int) ([]ingestiondomain.AuditLog, error)
	ListIntegrationConfigs(ctx context.Context) ([]ingestiondomain.IntegrationConfig, error)
	UpsertIntegrationConfig(ctx context.Context, config ingestiondomain.IntegrationConfig) error
	CreateIntegrationDelivery(ctx context.Context, delivery ingestiondomain.IntegrationDelivery) error
	ListIntegrationDeliveries(ctx context.Context, limit int) ([]ingestiondomain.IntegrationDelivery, error)
	ListSchedulerPauses(ctx context.Context) ([]ingestiondomain.SchedulerPause, error)
	CreateSchedulerPause(ctx context.Context, pause ingestiondomain.SchedulerPause) error
	DeleteSchedulerPause(ctx context.Context, pauseID string) error
	ListMaintenanceWindows(ctx context.Context) ([]ingestiondomain.MaintenanceWindow, error)
	CreateMaintenanceWindow(ctx context.Context, window ingestiondomain.MaintenanceWindow) error
	DeleteMaintenanceWindow(ctx context.Context, windowID string) error
}

// ImportPreviewRow describes one CSV preview result row.
type ImportPreviewRow struct {
	Errors []string `json:"errors,omitempty"`
	Label  string   `json:"label"`
	Row    int      `json:"row"`
	URL    string   `json:"url"`
	Valid  bool     `json:"valid"`
}

// ImportPreview summarizes a CSV import dry run.
type ImportPreview struct {
	Rows       []ImportPreviewRow `json:"rows"`
	ValidCount int                `json:"valid_count"`
}

// WorkspaceExport stores a portable workspace backup.
type WorkspaceExport struct {
	Alerts             []engagementdomain.AlertRule        `json:"alerts"`
	Analytics          ingestiondomain.PortfolioAnalytics  `json:"analytics"`
	AuditLogs          []ingestiondomain.AuditLog          `json:"audit_logs"`
	GeneratedAt        time.Time                           `json:"generated_at"`
	Integrations       []ingestiondomain.IntegrationConfig `json:"integrations"`
	MaintenanceWindows []ingestiondomain.MaintenanceWindow `json:"maintenance_windows"`
	Metadata           []ingestiondomain.PropertyMetadata  `json:"metadata"`
	Pauses             []ingestiondomain.SchedulerPause    `json:"pauses"`
	Properties         []ingestiondomain.Property          `json:"properties"`
}

// WorkspaceService owns property context, analytics, portability, integrations, and operations features.
type WorkspaceService struct {
	logger *slog.Logger
	store  WorkspaceStore
	client *http.Client
}

// NewWorkspaceService builds a workspace service.
func NewWorkspaceService(logger *slog.Logger, store WorkspaceStore) *WorkspaceService {
	return &WorkspaceService{
		logger: logger,
		store:  store,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// GetPropertyMetadata returns metadata or a default shell when none exists.
func (s *WorkspaceService) GetPropertyMetadata(ctx context.Context, propertyID string) (ingestiondomain.PropertyMetadata, error) {
	metadata, err := s.store.GetPropertyMetadata(ctx, propertyID)
	if err == nil {
		return metadata, nil
	}
	now := time.Now().UTC()
	return ingestiondomain.PropertyMetadata{
		PropertyID:    propertyID,
		WorkflowState: ingestiondomain.WorkflowStateUnreviewed,
		Priority:      "medium",
		CreatedAt:     now,
		UpdatedAt:     now,
	}, nil
}

// UpdatePropertyMetadata persists metadata and audit trails explicit state transitions.
func (s *WorkspaceService) UpdatePropertyMetadata(ctx context.Context, actor authdomain.User, metadata ingestiondomain.PropertyMetadata) (ingestiondomain.PropertyMetadata, error) {
	if strings.TrimSpace(metadata.PropertyID) == "" {
		return ingestiondomain.PropertyMetadata{}, fmt.Errorf("property id is required")
	}
	if metadata.WorkflowState == "" {
		metadata.WorkflowState = ingestiondomain.WorkflowStateUnreviewed
	}
	if metadata.Priority == "" {
		metadata.Priority = "medium"
	}
	if !validWorkflowState(metadata.WorkflowState) {
		return ingestiondomain.PropertyMetadata{}, fmt.Errorf("invalid workflow state")
	}
	existing, _ := s.store.GetPropertyMetadata(ctx, metadata.PropertyID)
	now := time.Now().UTC()
	if existing.PropertyID == "" {
		metadata.CreatedAt = now
	} else {
		metadata.CreatedAt = existing.CreatedAt
	}
	metadata.UpdatedAt = now
	if err := s.store.UpsertPropertyMetadata(ctx, metadata); err != nil {
		return ingestiondomain.PropertyMetadata{}, err
	}
	if existing.WorkflowState != metadata.WorkflowState {
		_ = s.store.CreateAuditLog(ctx, auditLog("property", metadata.PropertyID, fmt.Sprintf("Workflow state changed from %s to %s", emptyLabel(existing.WorkflowState, ingestiondomain.WorkflowStateUnreviewed), metadata.WorkflowState)))
	}
	_ = s.store.CreateAuditLog(ctx, auditLog("property", metadata.PropertyID, "Property context updated"))
	return metadata, nil
}

// RecordAudit logs an explicit workspace action.
func (s *WorkspaceService) RecordAudit(ctx context.Context, actor authdomain.User, targetKind, targetID, summary string) {
	_ = s.store.CreateAuditLog(ctx, auditLog(targetKind, targetID, summary))
}

// ListAuditLogs returns recent audit logs for a target.
func (s *WorkspaceService) ListAuditLogs(ctx context.Context, targetKind, targetID string, limit int) ([]ingestiondomain.AuditLog, error) {
	if limit <= 0 {
		limit = 100
	}
	return s.store.ListAuditLogs(ctx, targetKind, targetID, limit)
}

// ListIntegrations returns configured integrations.
func (s *WorkspaceService) ListIntegrations(ctx context.Context) ([]ingestiondomain.IntegrationConfig, error) {
	return s.store.ListIntegrationConfigs(ctx)
}

// SaveIntegration upserts an integration.
func (s *WorkspaceService) SaveIntegration(ctx context.Context, actor authdomain.User, config ingestiondomain.IntegrationConfig) (ingestiondomain.IntegrationConfig, error) {
	config.Kind = strings.TrimSpace(config.Kind)
	config.Name = strings.TrimSpace(config.Name)
	config.Target = strings.TrimSpace(config.Target)
	if config.Kind == "" || config.Name == "" || config.Target == "" {
		return ingestiondomain.IntegrationConfig{}, fmt.Errorf("kind, name, and target are required")
	}
	now := time.Now().UTC()
	if config.ID == "" {
		config.ID = id.New("intg")
		config.CreatedAt = now
	}
	config.UpdatedAt = now
	if config.RetryMaxAttempts <= 0 {
		config.RetryMaxAttempts = 3
	}
	if err := s.store.UpsertIntegrationConfig(ctx, config); err != nil {
		return ingestiondomain.IntegrationConfig{}, err
	}
	_ = s.store.CreateAuditLog(ctx, auditLog("integration", config.ID, "Integration configuration updated"))
	return config, nil
}

// TestIntegration performs a visible delivery attempt.
func (s *WorkspaceService) TestIntegration(ctx context.Context, actor authdomain.User, integrationID string) (ingestiondomain.IntegrationDelivery, error) {
	integrations, err := s.store.ListIntegrationConfigs(ctx)
	if err != nil {
		return ingestiondomain.IntegrationDelivery{}, err
	}
	var integration *ingestiondomain.IntegrationConfig
	for index := range integrations {
		if integrations[index].ID == integrationID {
			integration = &integrations[index]
			break
		}
	}
	if integration == nil {
		return ingestiondomain.IntegrationDelivery{}, fmt.Errorf("integration not found")
	}

	payloadMap := map[string]any{
		"message":   "home-searcher integration test",
		"timestamp": time.Now().UTC(),
	}
	payload, _ := json.Marshal(payloadMap)
	delivery := ingestiondomain.IntegrationDelivery{
		ID:            id.New("idel"),
		IntegrationID: integration.ID,
		TriggerKind:   "test",
		Status:        "pending",
		AttemptCount:  1,
		Payload:       payload,
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}
	err = s.sendIntegration(ctx, *integration, payload)
	if err != nil {
		delivery.Status = "failed"
		delivery.ErrorMessage = err.Error()
	} else {
		delivery.Status = "delivered"
	}
	if saveErr := s.store.CreateIntegrationDelivery(ctx, delivery); saveErr != nil {
		return ingestiondomain.IntegrationDelivery{}, saveErr
	}
	if delivery.Status == "delivered" {
		integration.LastTestStatus = delivery.Status
		now := time.Now().UTC()
		integration.LastTestAt = &now
		_ = s.store.UpsertIntegrationConfig(ctx, *integration)
	}
	return delivery, nil
}

// ListIntegrationDeliveries returns recent delivery attempts.
func (s *WorkspaceService) ListIntegrationDeliveries(ctx context.Context, limit int) ([]ingestiondomain.IntegrationDelivery, error) {
	if limit <= 0 {
		limit = 100
	}
	return s.store.ListIntegrationDeliveries(ctx, limit)
}

// CreateSchedulerPause persists a pause rule.
func (s *WorkspaceService) CreateSchedulerPause(ctx context.Context, actor authdomain.User, pause ingestiondomain.SchedulerPause) (ingestiondomain.SchedulerPause, error) {
	pause.ScopeType = strings.TrimSpace(pause.ScopeType)
	pause.ScopeValue = strings.TrimSpace(pause.ScopeValue)
	if pause.ScopeType == "" || pause.ScopeValue == "" {
		return ingestiondomain.SchedulerPause{}, fmt.Errorf("scope type and scope value are required")
	}
	pause.ID = id.New("pause")
	pause.CreatedAt = time.Now().UTC()
	if err := s.store.CreateSchedulerPause(ctx, pause); err != nil {
		return ingestiondomain.SchedulerPause{}, err
	}
	s.RecordAudit(ctx, actor, "scheduler_pause", pause.ID, fmt.Sprintf("Scheduler paused for %s %s", pause.ScopeType, pause.ScopeValue))
	return pause, nil
}

// DeleteSchedulerPause removes a pause rule.
func (s *WorkspaceService) DeleteSchedulerPause(ctx context.Context, actor authdomain.User, pauseID string) error {
	if err := s.store.DeleteSchedulerPause(ctx, pauseID); err != nil {
		return err
	}
	s.RecordAudit(ctx, actor, "scheduler_pause", pauseID, "Scheduler pause removed")
	return nil
}

// ListSchedulerPauses returns pause rules.
func (s *WorkspaceService) ListSchedulerPauses(ctx context.Context) ([]ingestiondomain.SchedulerPause, error) {
	return s.store.ListSchedulerPauses(ctx)
}

// CreateMaintenanceWindow stores a maintenance window.
func (s *WorkspaceService) CreateMaintenanceWindow(ctx context.Context, actor authdomain.User, window ingestiondomain.MaintenanceWindow) (ingestiondomain.MaintenanceWindow, error) {
	if strings.TrimSpace(window.Name) == "" || !window.StartsAt.Before(window.EndsAt) {
		return ingestiondomain.MaintenanceWindow{}, fmt.Errorf("valid maintenance window is required")
	}
	window.ID = id.New("mw")
	window.CreatedAt = time.Now().UTC()
	if err := s.store.CreateMaintenanceWindow(ctx, window); err != nil {
		return ingestiondomain.MaintenanceWindow{}, err
	}
	s.RecordAudit(ctx, actor, "maintenance_window", window.ID, "Maintenance window created")
	return window, nil
}

// DeleteMaintenanceWindow removes a maintenance window.
func (s *WorkspaceService) DeleteMaintenanceWindow(ctx context.Context, actor authdomain.User, windowID string) error {
	if err := s.store.DeleteMaintenanceWindow(ctx, windowID); err != nil {
		return err
	}
	s.RecordAudit(ctx, actor, "maintenance_window", windowID, "Maintenance window deleted")
	return nil
}

// ListMaintenanceWindows returns configured maintenance windows.
func (s *WorkspaceService) ListMaintenanceWindows(ctx context.Context) ([]ingestiondomain.MaintenanceWindow, error) {
	return s.store.ListMaintenanceWindows(ctx)
}

// GetSystemHealth computes queue and retry metrics.
func (s *WorkspaceService) GetSystemHealth(ctx context.Context) (ingestiondomain.SystemHealth, error) {
	properties, err := s.store.ListProperties(ctx)
	if err != nil {
		return ingestiondomain.SystemHealth{}, err
	}
	now := time.Now().UTC()
	queueDepth := 0
	totalRuns := 0
	totalRetries := 0
	completedLastDay := 0
	distribution := make(map[string]float64)
	for _, property := range properties {
		if property.NextRunAt != nil && !property.NextRunAt.After(now) && property.Status != ingestiondomain.PropertyStatusInactive {
			queueDepth++
		}
		runs, runsErr := s.store.ListPropertyRuns(ctx, property.ID, 100)
		if runsErr != nil {
			return ingestiondomain.SystemHealth{}, runsErr
		}
		for _, run := range runs {
			totalRuns++
			totalRetries += workspaceMaxInt(run.AttemptCount-1, 0)
			if run.Status == ingestiondomain.PropertyRunStatusFailed {
				distribution[property.SourceID]++
			}
			if run.FinishedAt != nil && run.FinishedAt.After(now.Add(-24*time.Hour)) {
				completedLastDay++
			}
		}
	}
	return ingestiondomain.SystemHealth{
		QueueDepth:           queueDepth,
		ProcessingThroughput: roundFloat(float64(completedLastDay) / 24),
		RetryRate:            ratio(totalRetries, totalRuns),
		FailureDistribution:  mapToSourceStats(distribution),
	}, nil
}

// BuildPortfolioAnalytics computes filtered workspace aggregates.
func (s *WorkspaceService) BuildPortfolioAnalytics(ctx context.Context, filter map[string]string) (ingestiondomain.PortfolioAnalytics, error) {
	properties, err := s.store.ListProperties(ctx)
	if err != nil {
		return ingestiondomain.PortfolioAnalytics{}, err
	}
	since := time.Now().UTC().Add(-30 * 24 * time.Hour)
	if raw := strings.TrimSpace(filter["time_range_days"]); raw != "" {
		if parsed, parseErr := strconv.Atoi(raw); parseErr == nil && parsed > 0 {
			since = time.Now().UTC().Add(-time.Duration(parsed) * 24 * time.Hour)
		}
	}
	tagFilter := strings.TrimSpace(filter["tag"])
	sourceFilter := strings.TrimSpace(filter["source"])
	priorityFilter := strings.TrimSpace(filter["priority"])

	priceChanges := make(map[string]float64)
	failures := make(map[string]float64)
	alertVolumes := make(map[string]float64)
	sourceReliability := make(map[string]float64)
	sourceTotals := make(map[string]float64)
	movers := make(map[string]float64)
	volatility := make(map[string]float64)
	risk := make(map[string]float64)
	propertyLabels := make(map[string]string)

	notifications, err := s.store.ListNotificationsForWorkspace(ctx, since)
	if err != nil {
		return ingestiondomain.PortfolioAnalytics{}, err
	}
	for _, notification := range notifications {
		label := notification.CreatedAt.Format("2006-01-02")
		alertVolumes[label]++
	}

	for _, property := range properties {
		if sourceFilter != "" && property.SourceID != sourceFilter {
			continue
		}
		if tagFilter != "" {
			tags, tagsErr := s.store.ListPropertyTags(ctx, property.ID)
			if tagsErr != nil {
				return ingestiondomain.PortfolioAnalytics{}, tagsErr
			}
			if !hasTag(tags, tagFilter) {
				continue
			}
		}
		metadata, _ := s.store.GetPropertyMetadata(ctx, property.ID)
		if priorityFilter != "" && metadata.Priority != priorityFilter {
			continue
		}
		propertyLabels[property.ID] = property.Label
		snapshots, snapshotsErr := s.store.ListPropertySnapshots(ctx, property.ID, 120)
		if snapshotsErr != nil {
			return ingestiondomain.PortfolioAnalytics{}, snapshotsErr
		}
		pricePoints, biggestMove := computePriceDeltas(snapshots, since)
		for label, value := range pricePoints {
			priceChanges[label] += value
		}
		movers[property.ID] = biggestMove
		volatility[property.ID] = float64(len(pricePoints))
		runs, runsErr := s.store.ListPropertyRuns(ctx, property.ID, 120)
		if runsErr != nil {
			return ingestiondomain.PortfolioAnalytics{}, runsErr
		}
		failed := 0
		for _, run := range runs {
			if run.CreatedAt.Before(since) {
				continue
			}
			if run.Status == ingestiondomain.PropertyRunStatusFailed {
				failures[run.CreatedAt.Format("2006-01-02")]++
				failed++
			}
			sourceTotals[property.SourceID]++
			if run.Status == ingestiondomain.PropertyRunStatusSuccess {
				sourceReliability[property.SourceID]++
			}
		}
		risk[property.ID] = float64(failed)
		if property.Status == ingestiondomain.PropertyStatusDegraded {
			risk[property.ID] += 1
		}
		if metadata.WorkflowState != ingestiondomain.WorkflowStateResolved {
			risk[property.ID] += 1
		}
	}
	sourceStats := make([]ingestiondomain.AnalyticsSourceStat, 0, len(sourceReliability))
	for sourceID, successes := range sourceReliability {
		sourceStats = append(sourceStats, ingestiondomain.AnalyticsSourceStat{
			SourceID: sourceID,
			Label:    emptyLabel(sourceID, "Unassigned"),
			Value:    ratio(int(successes), int(sourceTotals[sourceID])),
		})
	}
	sort.Slice(sourceStats, func(left, right int) bool { return sourceStats[left].Value > sourceStats[right].Value })

	return ingestiondomain.PortfolioAnalytics{
		UpdateFrequencySeconds: 60,
		PriceChangeTrends:      mapToPoints(priceChanges),
		FailureRateTrends:      mapToPoints(failures),
		SourceReliability:      sourceStats,
		MostVolatileProperties: mapToPropertyStats(volatility, propertyLabels),
		LargestPriceMovers:     mapToPropertyStats(movers, propertyLabels),
		AlertVolumeTrends:      mapToPoints(alertVolumes),
		OperationalRisk:        mapToPropertyStats(risk, propertyLabels),
	}, nil
}

// PreviewCSVImport validates CSV property import rows.
func (s *WorkspaceService) PreviewCSVImport(reader io.Reader) (ImportPreview, error) {
	records, err := csv.NewReader(reader).ReadAll()
	if err != nil {
		return ImportPreview{}, err
	}
	if len(records) == 0 {
		return ImportPreview{}, fmt.Errorf("csv is empty")
	}
	headers := indexHeaders(records[0])
	rows := make([]ImportPreviewRow, 0, len(records)-1)
	validCount := 0
	for index, record := range records[1:] {
		row := ImportPreviewRow{
			Label: valueFromRecord(record, headers, "label"),
			Row:   index + 2,
			URL:   valueFromRecord(record, headers, "url"),
			Valid: true,
		}
		if row.Label == "" {
			row.Errors = append(row.Errors, "label is required")
		}
		if row.URL == "" {
			row.Errors = append(row.Errors, "url is required")
		}
		row.Valid = len(row.Errors) == 0
		if row.Valid {
			validCount++
		}
		rows = append(rows, row)
	}
	return ImportPreview{Rows: rows, ValidCount: validCount}, nil
}

// ImportCSVProperties creates or updates properties from CSV rows after preview validation.
func (s *WorkspaceService) ImportCSVProperties(ctx context.Context, actor authdomain.User, reader io.Reader) (ImportPreview, error) {
	buffer, err := io.ReadAll(reader)
	if err != nil {
		return ImportPreview{}, err
	}
	preview, err := s.PreviewCSVImport(bytes.NewReader(buffer))
	if err != nil {
		return ImportPreview{}, err
	}
	if len(preview.Rows) == 0 {
		return preview, nil
	}
	records, _ := csv.NewReader(bytes.NewReader(buffer)).ReadAll()
	headers := indexHeaders(records[0])
	for _, row := range preview.Rows {
		if !row.Valid {
			continue
		}
		record := records[row.Row-1]
		now := time.Now().UTC()
		property := ingestiondomain.Property{
			ID:                      id.New("prop"),
			URL:                     row.URL,
			Label:                   row.Label,
			SourceID:                valueFromRecord(record, headers, "source_id"),
			Status:                  ingestiondomain.PropertyStatusPending,
			ScheduleIntervalSeconds: parseIntDefault(valueFromRecord(record, headers, "schedule_interval_seconds"), 0),
			RetryMaxAttempts:        parseIntDefault(valueFromRecord(record, headers, "retry_max_attempts"), 1),
			RetryBackoffMillis:      parseIntDefault(valueFromRecord(record, headers, "retry_backoff_millis"), 500),
			CreatedAt:               now,
			UpdatedAt:               now,
		}
		if err := s.store.UpsertProperty(ctx, property); err != nil {
			return preview, err
		}
		targetPrice := parseFloatPointer(valueFromRecord(record, headers, "target_price"))
		expectedYield := parseFloatPointer(valueFromRecord(record, headers, "expected_yield"))
		metadata := ingestiondomain.PropertyMetadata{
			PropertyID:       property.ID,
			WorkflowState:    defaultString(valueFromRecord(record, headers, "workflow_state"), ingestiondomain.WorkflowStateUnreviewed),
			Priority:         defaultString(valueFromRecord(record, headers, "priority"), "medium"),
			PipelineStage:    valueFromRecord(record, headers, "pipeline_stage"),
			TargetPrice:      targetPrice,
			ExpectedYield:    expectedYield,
			AcquisitionNotes: valueFromRecord(record, headers, "acquisition_notes"),
			DealThesis:       valueFromRecord(record, headers, "deal_thesis"),
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		_ = s.store.UpsertPropertyMetadata(ctx, metadata)
	}
	s.RecordAudit(ctx, actor, "workspace", "import", "CSV property import completed")
	return preview, nil
}

// ExportPropertiesCSV exports property and metadata rows.
func (s *WorkspaceService) ExportPropertiesCSV(ctx context.Context) ([]byte, error) {
	properties, err := s.store.ListProperties(ctx)
	if err != nil {
		return nil, err
	}
	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	if err := writer.Write([]string{"id", "label", "url", "source_id", "status", "workflow_state", "priority", "pipeline_stage", "target_price", "expected_yield"}); err != nil {
		return nil, err
	}
	for _, property := range properties {
		metadata, _ := s.store.GetPropertyMetadata(ctx, property.ID)
		row := []string{
			property.ID,
			property.Label,
			property.URL,
			property.SourceID,
			string(property.Status),
			metadata.WorkflowState,
			metadata.Priority,
			metadata.PipelineStage,
			floatPointerString(metadata.TargetPrice),
			floatPointerString(metadata.ExpectedYield),
		}
		if err := writer.Write(row); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	return buffer.Bytes(), writer.Error()
}

// ExportWorkspace exports a full workspace backup.
func (s *WorkspaceService) ExportWorkspace(ctx context.Context) (WorkspaceExport, error) {
	properties, err := s.store.ListProperties(ctx)
	if err != nil {
		return WorkspaceExport{}, err
	}
	result := WorkspaceExport{
		GeneratedAt: time.Now().UTC(),
		Properties:  properties,
	}
	for _, property := range properties {
		if metadata, metadataErr := s.store.GetPropertyMetadata(ctx, property.ID); metadataErr == nil {
			result.Metadata = append(result.Metadata, metadata)
		}
	}
	result.AuditLogs, _ = s.store.ListAuditLogs(ctx, "", "", 1000)
	result.Integrations, _ = s.store.ListIntegrationConfigs(ctx)
	result.Pauses, _ = s.store.ListSchedulerPauses(ctx)
	result.MaintenanceWindows, _ = s.store.ListMaintenanceWindows(ctx)
	result.Alerts, _ = s.store.ListAlertRulesForWorkspace(ctx)
	result.Analytics, _ = s.BuildPortfolioAnalytics(ctx, map[string]string{})
	return result, nil
}

// RestoreWorkspace validates or restores a workspace backup.
func (s *WorkspaceService) RestoreWorkspace(ctx context.Context, actor authdomain.User, payload WorkspaceExport, dryRun bool) (ImportPreview, error) {
	rows := make([]ImportPreviewRow, 0, len(payload.Properties))
	validCount := 0
	for index, property := range payload.Properties {
		row := ImportPreviewRow{
			Row:   index + 1,
			Label: property.Label,
			URL:   property.URL,
			Valid: strings.TrimSpace(property.Label) != "" && strings.TrimSpace(property.URL) != "",
		}
		if !row.Valid {
			row.Errors = []string{"property label and url are required"}
		} else {
			validCount++
		}
		rows = append(rows, row)
	}
	preview := ImportPreview{Rows: rows, ValidCount: validCount}
	if dryRun {
		return preview, nil
	}
	for _, property := range payload.Properties {
		if strings.TrimSpace(property.ID) == "" {
			property.ID = id.New("prop")
		}
		if err := s.store.UpsertProperty(ctx, property); err != nil {
			return preview, err
		}
	}
	for _, metadata := range payload.Metadata {
		_ = s.store.UpsertPropertyMetadata(ctx, metadata)
	}
	for _, integration := range payload.Integrations {
		_ = s.store.UpsertIntegrationConfig(ctx, integration)
	}
	for _, pause := range payload.Pauses {
		_ = s.store.CreateSchedulerPause(ctx, pause)
	}
	for _, window := range payload.MaintenanceWindows {
		_ = s.store.CreateMaintenanceWindow(ctx, window)
	}
	s.RecordAudit(ctx, actor, "workspace", "restore", "Workspace restore applied")
	return preview, nil
}

func (s *WorkspaceService) dispatchPropertyEvent(ctx context.Context, propertyID, triggerKind string, payload map[string]any) error {
	integrations, err := s.store.ListIntegrationConfigs(ctx)
	if err != nil {
		return err
	}
	for _, integration := range integrations {
		if !integration.Active || !integrationMatches(integration.Filters, propertyID, triggerKind) {
			continue
		}
		body, _ := json.Marshal(payload)
		delivery := ingestiondomain.IntegrationDelivery{
			ID:            id.New("idel"),
			IntegrationID: integration.ID,
			PropertyID:    propertyID,
			TriggerKind:   triggerKind,
			Status:        "pending",
			AttemptCount:  1,
			Payload:       body,
			CreatedAt:     time.Now().UTC(),
			UpdatedAt:     time.Now().UTC(),
		}
		if sendErr := s.sendIntegration(ctx, integration, body); sendErr != nil {
			delivery.Status = "failed"
			delivery.ErrorMessage = sendErr.Error()
		} else {
			delivery.Status = "delivered"
		}
		_ = s.store.CreateIntegrationDelivery(ctx, delivery)
	}
	return nil
}

func (s *WorkspaceService) sendIntegration(ctx context.Context, integration ingestiondomain.IntegrationConfig, payload []byte) error {
	switch integration.Kind {
	case "slack", "webhook":
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, integration.Target, bytes.NewReader(payload))
		if err != nil {
			return err
		}
		request.Header.Set("Content-Type", "application/json")
		response, err := s.client.Do(request)
		if err != nil {
			return err
		}
		defer response.Body.Close()
		if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
			return fmt.Errorf("integration returned %s", response.Status)
		}
		return nil
	case "email":
		return nil
	default:
		return fmt.Errorf("unsupported integration kind")
	}
}

func auditLog(targetKind, targetID, summary string) ingestiondomain.AuditLog {
	return ingestiondomain.AuditLog{
		ID:        id.New("audit"),
		TargetKind: targetKind,
		TargetID:   targetID,
		Summary:    summary,
		CreatedAt:  time.Now().UTC(),
	}
}

func validWorkflowState(value string) bool {
	switch value {
	case ingestiondomain.WorkflowStateUnreviewed, ingestiondomain.WorkflowStateInvestigating, ingestiondomain.WorkflowStateResolved:
		return true
	default:
		return false
	}
}

func integrationMatches(filters map[string]any, propertyID, triggerKind string) bool {
	if len(filters) == 0 {
		return true
	}
	if raw, ok := filters["trigger_kind"].(string); ok && raw != "" && raw != triggerKind {
		return false
	}
	if raw, ok := filters["property_id"].(string); ok && raw != "" && raw != propertyID {
		return false
	}
	return true
}

func indexHeaders(headers []string) map[string]int {
	index := make(map[string]int, len(headers))
	for i, header := range headers {
		index[strings.ToLower(strings.TrimSpace(header))] = i
	}
	return index
}

func valueFromRecord(record []string, headers map[string]int, name string) string {
	index, ok := headers[strings.ToLower(name)]
	if !ok || index >= len(record) {
		return ""
	}
	return strings.TrimSpace(record[index])
}

func parseIntDefault(raw string, defaultValue int) int {
	if raw == "" {
		return defaultValue
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil {
		return defaultValue
	}
	return parsed
}

func parseFloatPointer(raw string) *float64 {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parsed, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil {
		return nil
	}
	return &parsed
}

func floatPointerString(value *float64) string {
	if value == nil {
		return ""
	}
	return strconv.FormatFloat(*value, 'f', -1, 64)
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}


func computePriceDeltas(snapshots []ingestiondomain.PropertySnapshot, since time.Time) (map[string]float64, float64) {
	result := make(map[string]float64)
	if len(snapshots) < 2 {
		return result, 0
	}
	sort.Slice(snapshots, func(left, right int) bool {
		return snapshots[left].ObservedAt.Before(snapshots[right].ObservedAt)
	})
	biggestMove := 0.0
	for index := 1; index < len(snapshots); index++ {
		current := extractSnapshotPrice(snapshots[index])
		previous := extractSnapshotPrice(snapshots[index-1])
		if current == nil || previous == nil || snapshots[index].ObservedAt.Before(since) {
			continue
		}
		delta := math.Abs(*current - *previous)
		label := snapshots[index].ObservedAt.Format("2006-01-02")
		result[label] += delta
		if delta > biggestMove {
			biggestMove = delta
		}
	}
	return result, roundFloat(biggestMove)
}

func extractSnapshotPrice(snapshot ingestiondomain.PropertySnapshot) *float64 {
	values := make(map[string]string)
	if err := json.Unmarshal(snapshot.Values, &values); err != nil {
		return nil
	}
	raw := values["price"]
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var digits strings.Builder
	for _, char := range raw {
		if (char >= '0' && char <= '9') || char == '.' {
			digits.WriteRune(char)
		}
	}
	if digits.Len() == 0 {
		return nil
	}
	parsed, err := strconv.ParseFloat(digits.String(), 64)
	if err != nil {
		return nil
	}
	return &parsed
}

func mapToPoints(values map[string]float64) []ingestiondomain.AnalyticsPoint {
	if len(values) == 0 {
		return nil
	}
	labels := make([]string, 0, len(values))
	for label := range values {
		labels = append(labels, label)
	}
	sort.Strings(labels)
	points := make([]ingestiondomain.AnalyticsPoint, 0, len(labels))
	for _, label := range labels {
		points = append(points, ingestiondomain.AnalyticsPoint{Label: label, Value: roundFloat(values[label])})
	}
	return points
}

func mapToPropertyStats(values map[string]float64, labels map[string]string) []ingestiondomain.AnalyticsPropertyStat {
	stats := make([]ingestiondomain.AnalyticsPropertyStat, 0, len(values))
	for propertyID, value := range values {
		stats = append(stats, ingestiondomain.AnalyticsPropertyStat{
			PropertyID: propertyID,
			Label:      emptyLabel(labels[propertyID], propertyID),
			Value:      roundFloat(value),
		})
	}
	sort.Slice(stats, func(left, right int) bool { return stats[left].Value > stats[right].Value })
	if len(stats) > 5 {
		stats = stats[:5]
	}
	return stats
}

func mapToSourceStats(values map[string]float64) []ingestiondomain.AnalyticsSourceStat {
	stats := make([]ingestiondomain.AnalyticsSourceStat, 0, len(values))
	for sourceID, value := range values {
		stats = append(stats, ingestiondomain.AnalyticsSourceStat{
			SourceID: sourceID,
			Label:    emptyLabel(sourceID, "Unassigned"),
			Value:    roundFloat(value),
		})
	}
	sort.Slice(stats, func(left, right int) bool { return stats[left].Value > stats[right].Value })
	return stats
}

func ratio(numerator, denominator int) float64 {
	if denominator == 0 {
		return 0
	}
	return roundFloat(float64(numerator) / float64(denominator))
}

func roundFloat(value float64) float64 {
	return math.Round(value*100) / 100
}

func hasTag(tags []ingestiondomain.Tag, tagFilter string) bool {
	for _, tag := range tags {
		if tag.ID == tagFilter || strings.EqualFold(tag.Name, tagFilter) {
			return true
		}
	}
	return false
}

func emptyLabel(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func workspaceMaxInt(left, right int) int {
	if left > right {
		return left
	}
	return right
}
