package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	ingestiondomain "nido/server/internal/ingestion/domain"
	platformopsdomain "nido/server/internal/platformops/domain"
)

func (s *Store) ExportWorkspaceBackup(ctx context.Context) (platformopsdomain.WorkspaceBackup, error) {
	settings, err := s.GetPlatformSettings(ctx)
	if err != nil {
		return platformopsdomain.WorkspaceBackup{}, err
	}
	sources, err := s.listBackupSources(ctx)
	if err != nil {
		return platformopsdomain.WorkspaceBackup{}, err
	}
	properties, err := s.listBackupProperties(ctx)
	if err != nil {
		return platformopsdomain.WorkspaceBackup{}, err
	}
	propertyConfigs, err := s.listBackupPropertyConfigs(ctx)
	if err != nil {
		return platformopsdomain.WorkspaceBackup{}, err
	}
	propertySnapshots, err := s.listBackupPropertySnapshots(ctx)
	if err != nil {
		return platformopsdomain.WorkspaceBackup{}, err
	}
	propertyRuns, err := s.listBackupPropertyRuns(ctx)
	if err != nil {
		return platformopsdomain.WorkspaceBackup{}, err
	}
	tags, err := s.listBackupTags(ctx)
	if err != nil {
		return platformopsdomain.WorkspaceBackup{}, err
	}
	propertyTags, err := s.listBackupPropertyTags(ctx)
	if err != nil {
		return platformopsdomain.WorkspaceBackup{}, err
	}
	fieldDefinitions, err := s.listBackupFieldDefinitions(ctx)
	if err != nil {
		return platformopsdomain.WorkspaceBackup{}, err
	}
	propertyFieldValues, err := s.listBackupPropertyFieldValues(ctx)
	if err != nil {
		return platformopsdomain.WorkspaceBackup{}, err
	}

	return platformopsdomain.WorkspaceBackup{
		SchemaVersion:       platformopsdomain.WorkspaceBackupSchemaVersion,
		PlatformSettings:    settings,
		Sources:             sources,
		Properties:          properties,
		PropertyConfigs:     propertyConfigs,
		PropertySnapshots:   propertySnapshots,
		PropertyRuns:        propertyRuns,
		Tags:                tags,
		PropertyTags:        propertyTags,
		FieldDefinitions:    fieldDefinitions,
		PropertyFieldValues: propertyFieldValues,
	}, nil
}

func (s *Store) RestoreWorkspaceBackup(ctx context.Context, backup platformopsdomain.WorkspaceBackup) error {
	normalized, err := platformopsdomain.NormalizeWorkspaceBackup(backup)
	if err != nil {
		return err
	}
	if err := validateWorkspaceBackup(normalized); err != nil {
		return err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin backup restore transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	for _, statement := range []string{
		`DELETE FROM property_field_values`,
		`DELETE FROM property_runs`,
		`DELETE FROM property_tags`,
		`DELETE FROM property_snapshots`,
		`DELETE FROM property_extraction_configs`,
		`DELETE FROM properties`,
		`DELETE FROM tags`,
		`DELETE FROM sources`,
		`DELETE FROM field_definitions`,
		`DELETE FROM platform_settings`,
	} {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return fmt.Errorf("clear existing backup data: %w", err)
		}
	}

	for _, source := range normalized.Sources {
		if err := insertBackupSource(ctx, tx, source); err != nil {
			return err
		}
	}
	for _, property := range normalized.Properties {
		if err := insertBackupProperty(ctx, tx, property); err != nil {
			return err
		}
	}
	for _, config := range normalized.PropertyConfigs {
		if err := insertBackupPropertyConfig(ctx, tx, config); err != nil {
			return err
		}
	}
	for _, snapshot := range normalized.PropertySnapshots {
		if err := insertBackupPropertySnapshot(ctx, tx, snapshot); err != nil {
			return err
		}
	}
	for _, fieldDefinition := range normalized.FieldDefinitions {
		if err := insertBackupFieldDefinition(ctx, tx, fieldDefinition); err != nil {
			return err
		}
	}
	for _, fieldValue := range normalized.PropertyFieldValues {
		if err := insertBackupPropertyFieldValue(ctx, tx, fieldValue); err != nil {
			return err
		}
	}
	for _, run := range normalized.PropertyRuns {
		if err := insertBackupPropertyRun(ctx, tx, run); err != nil {
			return err
		}
	}
	for _, tag := range normalized.Tags {
		if err := insertBackupTag(ctx, tx, tag); err != nil {
			return err
		}
	}
	for _, propertyTag := range normalized.PropertyTags {
		if err := insertBackupPropertyTag(ctx, tx, propertyTag); err != nil {
			return err
		}
	}
	if err := insertBackupPlatformSettings(ctx, tx, normalized.PlatformSettings); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit backup restore: %w", err)
	}

	return nil
}

func (s *Store) listBackupSources(ctx context.Context) ([]ingestiondomain.Source, error) {
	rows, err := s.db.QueryContext(ctx, sourceSelect+` ORDER BY created_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("list backup sources: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.Source, 0)
	for rows.Next() {
		source, err := scanSource(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, source)
	}
	return items, rows.Err()
}

func (s *Store) listBackupProperties(ctx context.Context) ([]ingestiondomain.Property, error) {
	rows, err := s.db.QueryContext(ctx, propertySelect+` ORDER BY created_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("list backup properties: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.Property, 0)
	for rows.Next() {
		property, err := scanProperty(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, property)
	}
	return items, rows.Err()
}

func (s *Store) listBackupPropertyConfigs(ctx context.Context) ([]ingestiondomain.PropertyExtractionConfig, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, property_id, fields_json, version, created_at, change_summary FROM property_extraction_configs ORDER BY property_id ASC, version ASC`)
	if err != nil {
		return nil, fmt.Errorf("list backup property configs: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.PropertyExtractionConfig, 0)
	for rows.Next() {
		item, err := scanPropertyConfig(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) listBackupPropertySnapshots(ctx context.Context) ([]ingestiondomain.PropertySnapshot, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message FROM property_snapshots ORDER BY property_id ASC, observed_at ASC, id ASC`)
	if err != nil {
		return nil, fmt.Errorf("list backup property snapshots: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.PropertySnapshot, 0)
	for rows.Next() {
		item, err := scanPropertySnapshot(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) listBackupPropertyRuns(ctx context.Context) ([]ingestiondomain.PropertyRun, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, property_id, status, trigger_kind, attempt_count, max_attempts, started_at, finished_at, error_message, snapshot_id, created_at FROM property_runs ORDER BY property_id ASC, created_at ASC, id ASC`)
	if err != nil {
		return nil, fmt.Errorf("list backup property runs: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.PropertyRun, 0)
	for rows.Next() {
		item, err := scanPropertyRun(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) listBackupTags(ctx context.Context) ([]ingestiondomain.Tag, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, name, color, created_at, updated_at FROM tags ORDER BY created_at ASC, name ASC`)
	if err != nil {
		return nil, fmt.Errorf("list backup tags: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.Tag, 0)
	for rows.Next() {
		item, err := scanTag(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) listBackupPropertyTags(ctx context.Context) ([]platformopsdomain.WorkspaceBackupPropertyTag, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT property_id, tag_id, assigned_at FROM property_tags ORDER BY property_id ASC, tag_id ASC`)
	if err != nil {
		return nil, fmt.Errorf("list backup property tags: %w", err)
	}
	defer rows.Close()

	items := make([]platformopsdomain.WorkspaceBackupPropertyTag, 0)
	for rows.Next() {
		var (
			item       platformopsdomain.WorkspaceBackupPropertyTag
			assignedAt string
		)
		if err := rows.Scan(&item.PropertyID, &item.TagID, &assignedAt); err != nil {
			return nil, err
		}
		item.AssignedAt, err = parseTime(assignedAt)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) listBackupFieldDefinitions(ctx context.Context) ([]ingestiondomain.FieldDefinition, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, name, display_name, data_type, unit, description, enum_values_json, default_value, use_default_when_missing, comparison_operator, comparison_value, system_defined, created_at, updated_at FROM field_definitions ORDER BY system_defined DESC, name ASC`)
	if err != nil {
		return nil, fmt.Errorf("list backup field definitions: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.FieldDefinition, 0)
	for rows.Next() {
		item, err := scanFieldDefinition(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) listBackupPropertyFieldValues(ctx context.Context) ([]platformopsdomain.WorkspaceBackupPropertyFieldValue, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, property_id, snapshot_id, field_definition_id, field_name, selector_name, config_version, value_text, observed_at, validation_status, validation_message, created_at FROM property_field_values ORDER BY property_id ASC, observed_at ASC, id ASC`)
	if err != nil {
		return nil, fmt.Errorf("list backup property field values: %w", err)
	}
	defer rows.Close()

	items := make([]platformopsdomain.WorkspaceBackupPropertyFieldValue, 0)
	for rows.Next() {
		var (
			item              platformopsdomain.WorkspaceBackupPropertyFieldValue
			fieldDefinitionID sql.NullString
			observedAt        string
			createdAt         string
		)
		if err := rows.Scan(
			&item.ID,
			&item.PropertyID,
			&item.SnapshotID,
			&fieldDefinitionID,
			&item.FieldName,
			&item.SelectorName,
			&item.ConfigVersion,
			&item.Value,
			&observedAt,
			&item.ValidationStatus,
			&item.ValidationMessage,
			&createdAt,
		); err != nil {
			return nil, err
		}
		item.FieldDefinitionID = fieldDefinitionID.String
		item.ObservedAt, err = parseTime(observedAt)
		if err != nil {
			return nil, err
		}
		item.CreatedAt, err = parseTime(createdAt)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func validateWorkspaceBackup(backup platformopsdomain.WorkspaceBackup) error {
	sourceIDs := make(map[string]struct{}, len(backup.Sources))
	propertyIDs := make(map[string]struct{}, len(backup.Properties))
	snapshotIDs := make(map[string]struct{}, len(backup.PropertySnapshots))
	tagIDs := make(map[string]struct{}, len(backup.Tags))
	fieldDefinitionIDs := make(map[string]struct{}, len(backup.FieldDefinitions))

	for _, source := range backup.Sources {
		if strings.TrimSpace(source.ID) == "" {
			return fmt.Errorf("backup source id is required")
		}
		sourceIDs[source.ID] = struct{}{}
	}
	for _, property := range backup.Properties {
		if strings.TrimSpace(property.ID) == "" {
			return fmt.Errorf("backup property id is required")
		}
		if strings.TrimSpace(property.SourceID) != "" {
			if _, ok := sourceIDs[property.SourceID]; !ok {
				return fmt.Errorf("backup property %s references unknown source %s", property.ID, property.SourceID)
			}
		}
		propertyIDs[property.ID] = struct{}{}
	}
	for _, config := range backup.PropertyConfigs {
		if _, ok := propertyIDs[config.PropertyID]; !ok {
			return fmt.Errorf("backup property config %s references unknown property %s", config.ID, config.PropertyID)
		}
	}
	for _, snapshot := range backup.PropertySnapshots {
		if _, ok := propertyIDs[snapshot.PropertyID]; !ok {
			return fmt.Errorf("backup snapshot %s references unknown property %s", snapshot.ID, snapshot.PropertyID)
		}
		snapshotIDs[snapshot.ID] = struct{}{}
	}
	for _, tag := range backup.Tags {
		if strings.TrimSpace(tag.ID) == "" {
			return fmt.Errorf("backup tag id is required")
		}
		tagIDs[tag.ID] = struct{}{}
	}
	for _, fieldDefinition := range backup.FieldDefinitions {
		if strings.TrimSpace(fieldDefinition.ID) == "" {
			return fmt.Errorf("backup field definition id is required")
		}
		fieldDefinitionIDs[fieldDefinition.ID] = struct{}{}
	}
	for _, run := range backup.PropertyRuns {
		if _, ok := propertyIDs[run.PropertyID]; !ok {
			return fmt.Errorf("backup run %s references unknown property %s", run.ID, run.PropertyID)
		}
		if strings.TrimSpace(run.SnapshotID) != "" {
			if _, ok := snapshotIDs[run.SnapshotID]; !ok {
				return fmt.Errorf("backup run %s references unknown snapshot %s", run.ID, run.SnapshotID)
			}
		}
	}
	for _, propertyTag := range backup.PropertyTags {
		if _, ok := propertyIDs[propertyTag.PropertyID]; !ok {
			return fmt.Errorf("backup property-tag references unknown property %s", propertyTag.PropertyID)
		}
		if _, ok := tagIDs[propertyTag.TagID]; !ok {
			return fmt.Errorf("backup property-tag references unknown tag %s", propertyTag.TagID)
		}
	}
	for _, fieldValue := range backup.PropertyFieldValues {
		if _, ok := propertyIDs[fieldValue.PropertyID]; !ok {
			return fmt.Errorf("backup field value %s references unknown property %s", fieldValue.ID, fieldValue.PropertyID)
		}
		if _, ok := snapshotIDs[fieldValue.SnapshotID]; !ok {
			return fmt.Errorf("backup field value %s references unknown snapshot %s", fieldValue.ID, fieldValue.SnapshotID)
		}
		if strings.TrimSpace(fieldValue.FieldDefinitionID) != "" {
			if _, ok := fieldDefinitionIDs[fieldValue.FieldDefinitionID]; !ok {
				return fmt.Errorf("backup field value %s references unknown field definition %s", fieldValue.ID, fieldValue.FieldDefinitionID)
			}
		}
	}

	return nil
}

func insertBackupSource(ctx context.Context, tx *sql.Tx, source ingestiondomain.Source) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO sources (
            id, name, kind, endpoint_url, config_json, browser_enabled, active,
            rate_limit_window_seconds, rate_limit_max_requests, retry_max_attempts, retry_backoff_millis,
            schedule_interval_seconds, freshness_window_seconds, next_run_at, last_run_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		source.ID,
		source.Name,
		source.Kind,
		source.EndpointURL,
		normalizeJSONString(source.ConfigJSON),
		boolToInt(source.BrowserEnabled),
		boolToInt(source.Active),
		source.RateLimitWindowSeconds,
		source.RateLimitMaxRequests,
		source.RetryMaxAttempts,
		source.RetryBackoffMillis,
		source.ScheduleIntervalSeconds,
		source.FreshnessWindowSeconds,
		nullableTimeString(source.NextRunAt),
		nullableTimeString(source.LastRunAt),
		formatTime(source.CreatedAt),
		formatTime(source.UpdatedAt),
	)
	if err != nil {
		return fmt.Errorf("restore source %s: %w", source.ID, err)
	}
	return nil
}

func insertBackupProperty(ctx context.Context, tx *sql.Tx, property ingestiondomain.Property) error {
	requestHeadersJSON := "{}"
	if len(property.RequestHeaders) > 0 {
		encodedRequestHeaders, err := json.Marshal(property.RequestHeaders)
		if err != nil {
			return fmt.Errorf("marshal property request headers: %w", err)
		}
		requestHeadersJSON = string(encodedRequestHeaders)
	}
	metadataJSON := "{}"
	if !propertyMetadataIsZero(property.Metadata) {
		encodedMetadata, err := json.Marshal(property.Metadata)
		if err != nil {
			return fmt.Errorf("marshal property metadata: %w", err)
		}
		metadataJSON = string(encodedMetadata)
	}

	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO properties (id, url, label, source_id, browser_enabled, request_headers_json, status, schedule_interval_seconds, retry_max_attempts, retry_backoff_millis, paused, pause_reason, metadata_json, last_run_at, next_run_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		property.ID,
		property.URL,
		property.Label,
		nullableString(property.SourceID),
		boolToInt(property.BrowserEnabled),
		normalizeJSONString(requestHeadersJSON),
		string(property.Status),
		property.ScheduleIntervalSeconds,
		property.RetryMaxAttempts,
		property.RetryBackoffMillis,
		boolToInt(property.Paused),
		strings.TrimSpace(property.PauseReason),
		normalizeJSONString(metadataJSON),
		nullableTimeString(property.LastRunAt),
		nullableTimeString(property.NextRunAt),
		formatTime(property.CreatedAt),
		formatTime(property.UpdatedAt),
	)
	if err != nil {
		return fmt.Errorf("restore property %s: %w", property.ID, err)
	}
	return nil
}

func insertBackupPropertyConfig(ctx context.Context, tx *sql.Tx, config ingestiondomain.PropertyExtractionConfig) error {
	fieldsJSON, err := json.Marshal(config.Fields)
	if err != nil {
		return fmt.Errorf("marshal property config fields: %w", err)
	}
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO property_extraction_configs (id, property_id, fields_json, version, created_at, change_summary) VALUES (?, ?, ?, ?, ?, ?)`,
		config.ID,
		config.PropertyID,
		string(fieldsJSON),
		config.Version,
		formatTime(config.CreatedAt),
		config.ChangeSummary,
	)
	if err != nil {
		return fmt.Errorf("restore property config %s: %w", config.ID, err)
	}
	return nil
}

func insertBackupPropertySnapshot(ctx context.Context, tx *sql.Tx, snapshot ingestiondomain.PropertySnapshot) error {
	valuesJSON := string(snapshot.Values)
	if valuesJSON == "" {
		valuesJSON = "{}"
	}
	changeFlagsJSON := string(snapshot.ChangeFlags)
	if changeFlagsJSON == "" {
		changeFlagsJSON = "{}"
	}
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO property_snapshots (id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		snapshot.ID,
		snapshot.PropertyID,
		snapshot.ConfigVersion,
		formatTime(snapshot.ObservedAt),
		normalizeJSONString(valuesJSON),
		normalizeJSONString(changeFlagsJSON),
		boolToInt(snapshot.IsValid),
		nullableString(snapshot.ErrorMessage),
	)
	if err != nil {
		return fmt.Errorf("restore property snapshot %s: %w", snapshot.ID, err)
	}
	return nil
}

func insertBackupFieldDefinition(ctx context.Context, tx *sql.Tx, field ingestiondomain.FieldDefinition) error {
	enumJSON, err := json.Marshal(field.EnumValues)
	if err != nil {
		return fmt.Errorf("marshal field definition enum values: %w", err)
	}
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO field_definitions (id, name, display_name, data_type, unit, description, enum_values_json, default_value, use_default_when_missing, comparison_operator, comparison_value, system_defined, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		field.ID,
		field.Name,
		field.DisplayName,
		string(field.DataType),
		field.Unit,
		field.Description,
		string(enumJSON),
		field.DefaultValue,
		boolToInt(field.UseDefaultWhenMissing),
		field.ComparisonOperator,
		field.ComparisonValue,
		boolToInt(field.SystemDefined),
		formatTime(field.CreatedAt),
		formatTime(field.UpdatedAt),
	)
	if err != nil {
		return fmt.Errorf("restore field definition %s: %w", field.ID, err)
	}
	return nil
}

func insertBackupPropertyFieldValue(ctx context.Context, tx *sql.Tx, fieldValue platformopsdomain.WorkspaceBackupPropertyFieldValue) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO property_field_values (id, property_id, snapshot_id, field_definition_id, field_name, selector_name, config_version, value_text, observed_at, validation_status, validation_message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		fieldValue.ID,
		fieldValue.PropertyID,
		fieldValue.SnapshotID,
		nullableString(fieldValue.FieldDefinitionID),
		fieldValue.FieldName,
		fieldValue.SelectorName,
		fieldValue.ConfigVersion,
		fieldValue.Value,
		formatTime(fieldValue.ObservedAt),
		fieldValue.ValidationStatus,
		fieldValue.ValidationMessage,
		formatTime(fieldValue.CreatedAt),
	)
	if err != nil {
		return fmt.Errorf("restore property field value %s: %w", fieldValue.ID, err)
	}
	return nil
}

func insertBackupPropertyRun(ctx context.Context, tx *sql.Tx, run ingestiondomain.PropertyRun) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO property_runs (id, property_id, status, trigger_kind, attempt_count, max_attempts, started_at, finished_at, error_message, snapshot_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		run.ID,
		run.PropertyID,
		string(run.Status),
		run.TriggerKind,
		run.AttemptCount,
		run.MaxAttempts,
		nullableTimeString(run.StartedAt),
		nullableTimeString(run.FinishedAt),
		nullableString(run.ErrorMessage),
		nullableString(run.SnapshotID),
		formatTime(run.CreatedAt),
	)
	if err != nil {
		return fmt.Errorf("restore property run %s: %w", run.ID, err)
	}
	return nil
}

func insertBackupTag(ctx context.Context, tx *sql.Tx, tag ingestiondomain.Tag) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO tags (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		tag.ID,
		tag.Name,
		tag.Color,
		formatTime(tag.CreatedAt),
		formatTime(tag.UpdatedAt),
	)
	if err != nil {
		return fmt.Errorf("restore tag %s: %w", tag.ID, err)
	}
	return nil
}

func insertBackupPropertyTag(ctx context.Context, tx *sql.Tx, propertyTag platformopsdomain.WorkspaceBackupPropertyTag) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO property_tags (property_id, tag_id, assigned_at) VALUES (?, ?, ?)`,
		propertyTag.PropertyID,
		propertyTag.TagID,
		formatTime(propertyTag.AssignedAt),
	)
	if err != nil {
		return fmt.Errorf("restore property tag %s/%s: %w", propertyTag.PropertyID, propertyTag.TagID, err)
	}
	return nil
}

func insertBackupPlatformSettings(ctx context.Context, tx *sql.Tx, settings platformopsdomain.PlatformSettings) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO platform_settings (
            id, scheduler_enabled, maintenance_window_enabled, maintenance_window_start, maintenance_window_end,
            webhook_url, webhook_events_json, slack_webhook_url, slack_events_json,
            spreadsheet_webhook_url, spreadsheet_events_json, task_webhook_url, task_events_json,
            email_digest_enabled, email_digest_recipient, email_digest_schedule, email_digest_events_json,
            last_digest_sent_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		settings.ID,
		boolToInt(settings.SchedulerEnabled),
		boolToInt(settings.MaintenanceWindowEnabled),
		strings.TrimSpace(settings.MaintenanceWindowStart),
		strings.TrimSpace(settings.MaintenanceWindowEnd),
		strings.TrimSpace(settings.Webhook.URL),
		mustMarshalJSON(settings.Webhook.Events, "[]"),
		strings.TrimSpace(settings.Slack.URL),
		mustMarshalJSON(settings.Slack.Events, "[]"),
		strings.TrimSpace(settings.Spreadsheet.URL),
		mustMarshalJSON(settings.Spreadsheet.Events, "[]"),
		strings.TrimSpace(settings.TaskSystem.URL),
		mustMarshalJSON(settings.TaskSystem.Events, "[]"),
		boolToInt(settings.EmailDigest.Enabled),
		strings.TrimSpace(settings.EmailDigest.Recipient),
		strings.TrimSpace(settings.EmailDigest.Schedule),
		mustMarshalJSON(settings.EmailDigest.Events, "[]"),
		nullableTimeString(settings.EmailDigest.LastSentAt),
		formatTime(settings.UpdatedAt),
	)
	if err != nil {
		return fmt.Errorf("restore platform settings: %w", err)
	}
	return nil
}
