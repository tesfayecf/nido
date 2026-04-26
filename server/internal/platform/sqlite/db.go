package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"

	ingestiondomain "nido/server/internal/ingestion/domain"
	"nido/server/internal/platform/config"
)

// Open builds a configured SQLite handle for the backend runtime.
func Open(ctx context.Context, cfg config.DatabaseConfig) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(cfg.Path), 0o755); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}

	dsn := fmt.Sprintf(
		"file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)&_txlock=immediate",
		strings.ReplaceAll(cfg.Path, "\\", "/"),
	)

	db, err := openDatabase(ctx, dsn)
	if err == nil {
		return db, nil
	}
	if !isCorruptDatabaseError(err) {
		return nil, err
	}

	backupPath, backupErr := quarantineCorruptDatabase(cfg.Path)
	if backupErr != nil {
		return nil, fmt.Errorf("%w; quarantine corrupt sqlite database: %v", err, backupErr)
	}

	db, retryErr := openDatabase(ctx, dsn)
	if retryErr != nil {
		return nil, fmt.Errorf("%w; quarantined corrupt sqlite database at %s but reopen failed: %v", err, backupPath, retryErr)
	}

	return db, nil
}

func openDatabase(ctx context.Context, dsn string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite database: %w", err)
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping sqlite database: %w", err)
	}

	return db, nil
}

func isCorruptDatabaseError(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "database disk image is malformed") ||
		strings.Contains(message, "file is not a database") ||
		strings.Contains(message, "database schema is corrupt")
}

func quarantineCorruptDatabase(path string) (string, error) {
	backupPath := nextCorruptDatabaseBackupPath(path)
	if err := renameIfExists(path, backupPath); err != nil {
		return "", err
	}
	if err := renameIfExists(path+"-wal", backupPath+"-wal"); err != nil {
		return "", err
	}
	if err := renameIfExists(path+"-shm", backupPath+"-shm"); err != nil {
		return "", err
	}
	return backupPath, nil
}

func nextCorruptDatabaseBackupPath(path string) string {
	timestamp := time.Now().UTC().Format("20060102-150405")
	base := fmt.Sprintf("%s.corrupt-%s", path, timestamp)
	if _, err := os.Stat(base); os.IsNotExist(err) {
		return base
	}

	for attempt := 1; ; attempt++ {
		candidate := fmt.Sprintf("%s-%d", base, attempt)
		if _, err := os.Stat(candidate); os.IsNotExist(err) {
			return candidate
		}
	}
}

func renameIfExists(from string, to string) error {
	if _, err := os.Stat(from); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("stat %s: %w", from, err)
	}
	if err := os.Rename(from, to); err != nil {
		return fmt.Errorf("rename %s to %s: %w", from, to, err)
	}
	return nil
}

// Migrate applies the SQLite schema required by the first iteration.
func Migrate(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, schema)
	if err != nil {
		return fmt.Errorf("apply sqlite schema: %w", err)
	}

	for _, migration := range columnMigrations {
		if err := ensureColumn(ctx, db, migration); err != nil {
			return err
		}
	}

	if err := prepareSystemFieldDefinitionsForSeed(ctx, db); err != nil {
		return err
	}
	if err := seedFieldDefinitions(ctx, db); err != nil {
		return err
	}
	if err := reconcilePropertyFieldDefinitionReferences(ctx, db); err != nil {
		return err
	}
	if err := cleanupLegacySystemFieldDefinitions(ctx, db); err != nil {
		return err
	}
	if err := backfillPropertyFieldValues(ctx, db); err != nil {
		return err
	}

	return nil
}

type columnMigration struct {
	table      string
	column     string
	definition string
}

func ensureColumn(ctx context.Context, db *sql.DB, migration columnMigration) error {
	rows, err := db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", migration.table))
	if err != nil {
		return fmt.Errorf("inspect table %q: %w", migration.table, err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			cid        int
			name       string
			dataType   string
			notNull    int
			defaultV   sql.NullString
			primaryKey int
		)

		if err := rows.Scan(&cid, &name, &dataType, &notNull, &defaultV, &primaryKey); err != nil {
			return fmt.Errorf("scan table info for %q: %w", migration.table, err)
		}

		if name == migration.column {
			return nil
		}
	}

	if _, err := db.ExecContext(ctx, fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", migration.table, migration.column, migration.definition)); err != nil {
		return fmt.Errorf("add column %q.%q: %w", migration.table, migration.column, err)
	}

	return nil
}

const schema = `
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    endpoint_url TEXT NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    browser_enabled INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    rate_limit_window_seconds INTEGER NOT NULL DEFAULT 0,
    rate_limit_max_requests INTEGER NOT NULL DEFAULT 0,
    retry_max_attempts INTEGER NOT NULL DEFAULT 1,
    retry_backoff_millis INTEGER NOT NULL DEFAULT 500,
    schedule_interval_seconds INTEGER NOT NULL DEFAULT 0,
    freshness_window_seconds INTEGER NOT NULL DEFAULT 0,
    next_run_at TEXT,
    last_run_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id),
    correlation_id TEXT NOT NULL DEFAULT '',
    trigger_kind TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    item_count INTEGER NOT NULL DEFAULT 0,
    artifact_key TEXT,
    failure_artifact_key TEXT,
    diagnostics_json TEXT NOT NULL DEFAULT '{}',
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source_started_at ON ingestion_runs(source_id, started_at DESC);

CREATE TABLE IF NOT EXISTS ingestion_locks (
    source_id TEXT PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
    holder_id TEXT NOT NULL,
    acquired_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
    key TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id),
    run_id TEXT NOT NULL REFERENCES ingestion_runs(id),
    kind TEXT NOT NULL,
    content_type TEXT NOT NULL,
    checksum TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_source_created_at ON artifacts(source_id, created_at DESC);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS bookmarks (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY(user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created_at ON bookmarks(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL,
    threshold_amount INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id ON alert_rules(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled, rule_type);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id TEXT REFERENCES alert_rules(id) ON DELETE SET NULL,
    property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}',
    delivery_status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    read_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
    browser_enabled INTEGER NOT NULL DEFAULT 0,
    request_headers_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    schedule_interval_seconds INTEGER NOT NULL DEFAULT 0,
    retry_max_attempts INTEGER NOT NULL DEFAULT 1,
    retry_backoff_millis INTEGER NOT NULL DEFAULT 500,
    paused INTEGER NOT NULL DEFAULT 0,
    pause_reason TEXT NOT NULL DEFAULT '',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    last_run_at TEXT,
    next_run_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_next_run_at ON properties(next_run_at);
CREATE INDEX IF NOT EXISTS idx_properties_source_id ON properties(source_id);

CREATE TABLE IF NOT EXISTS property_extraction_configs (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    fields_json TEXT NOT NULL DEFAULT '[]',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    change_summary TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_property_configs_property_version ON property_extraction_configs(property_id, version DESC);

CREATE TABLE IF NOT EXISTS property_snapshots (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    config_version INTEGER NOT NULL DEFAULT 1,
    observed_at TEXT NOT NULL,
    values_json TEXT NOT NULL DEFAULT '{}',
    change_flags_json TEXT NOT NULL DEFAULT '{}',
    is_valid INTEGER NOT NULL DEFAULT 1,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_property_snapshots_property_observed ON property_snapshots(property_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    color TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS property_tags (
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    assigned_at TEXT NOT NULL,
    PRIMARY KEY(property_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_property_tags_tag_id ON property_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_property_tags_property_id ON property_tags(property_id);

CREATE TABLE IF NOT EXISTS property_runs (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    trigger_kind TEXT NOT NULL DEFAULT 'scheduled',
    attempt_count INTEGER NOT NULL DEFAULT 1,
    max_attempts INTEGER NOT NULL DEFAULT 1,
    started_at TEXT,
    finished_at TEXT,
    error_message TEXT,
    snapshot_id TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_property_runs_property_started ON property_runs(property_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_runs_status ON property_runs(status);

CREATE TABLE IF NOT EXISTS field_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    data_type TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    enum_values_json TEXT NOT NULL DEFAULT '[]',
    default_value TEXT NOT NULL DEFAULT '',
    use_default_when_missing INTEGER NOT NULL DEFAULT 0,
    comparison_operator TEXT NOT NULL DEFAULT '',
    comparison_value TEXT NOT NULL DEFAULT '',
    system_defined INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_field_definitions_system_name ON field_definitions(system_defined, name);

CREATE TABLE IF NOT EXISTS property_field_values (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    snapshot_id TEXT NOT NULL REFERENCES property_snapshots(id) ON DELETE CASCADE,
    field_definition_id TEXT REFERENCES field_definitions(id) ON DELETE SET NULL,
    field_name TEXT NOT NULL DEFAULT '',
    selector_name TEXT NOT NULL,
    config_version INTEGER NOT NULL DEFAULT 1,
    value_text TEXT NOT NULL DEFAULT '',
    observed_at TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'unmapped',
    validation_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_field_values_snapshot_selector ON property_field_values(snapshot_id, selector_name);
CREATE INDEX IF NOT EXISTS idx_property_field_values_field_observed ON property_field_values(field_definition_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_field_values_property_selector ON property_field_values(property_id, selector_name, observed_at DESC);

CREATE TABLE IF NOT EXISTS platform_settings (
    id TEXT PRIMARY KEY,
    scheduler_enabled INTEGER NOT NULL DEFAULT 1,
    maintenance_window_enabled INTEGER NOT NULL DEFAULT 0,
    maintenance_window_start TEXT NOT NULL DEFAULT '',
    maintenance_window_end TEXT NOT NULL DEFAULT '',
    webhook_url TEXT NOT NULL DEFAULT '',
    webhook_events_json TEXT NOT NULL DEFAULT '[]',
    slack_webhook_url TEXT NOT NULL DEFAULT '',
    slack_events_json TEXT NOT NULL DEFAULT '[]',
    spreadsheet_webhook_url TEXT NOT NULL DEFAULT '',
    spreadsheet_events_json TEXT NOT NULL DEFAULT '[]',
    task_webhook_url TEXT NOT NULL DEFAULT '',
    task_events_json TEXT NOT NULL DEFAULT '[]',
    email_digest_enabled INTEGER NOT NULL DEFAULT 0,
    email_digest_recipient TEXT NOT NULL DEFAULT '',
    email_digest_schedule TEXT NOT NULL DEFAULT '09:00',
    email_digest_events_json TEXT NOT NULL DEFAULT '[]',
    last_digest_sent_at TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integration_delivery_logs (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    event_type TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    payload_json TEXT NOT NULL DEFAULT '{}',
    response_status INTEGER,
    error_message TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_delivery_logs_created_at ON integration_delivery_logs(created_at DESC);
`

var columnMigrations = []columnMigration{
	{table: "sources", column: "config_json", definition: "TEXT NOT NULL DEFAULT '{}'"},
	{table: "sources", column: "browser_enabled", definition: "INTEGER NOT NULL DEFAULT 0"},
	{table: "sources", column: "rate_limit_window_seconds", definition: "INTEGER NOT NULL DEFAULT 0"},
	{table: "sources", column: "rate_limit_max_requests", definition: "INTEGER NOT NULL DEFAULT 0"},
	{table: "sources", column: "retry_max_attempts", definition: "INTEGER NOT NULL DEFAULT 1"},
	{table: "sources", column: "retry_backoff_millis", definition: "INTEGER NOT NULL DEFAULT 500"},
	{table: "sources", column: "schedule_interval_seconds", definition: "INTEGER NOT NULL DEFAULT 0"},
	{table: "sources", column: "freshness_window_seconds", definition: "INTEGER NOT NULL DEFAULT 0"},
	{table: "sources", column: "next_run_at", definition: "TEXT"},
	{table: "sources", column: "last_run_at", definition: "TEXT"},
	{table: "ingestion_runs", column: "correlation_id", definition: "TEXT NOT NULL DEFAULT ''"},
	{table: "ingestion_runs", column: "trigger_kind", definition: "TEXT NOT NULL DEFAULT 'manual'"},
	{table: "ingestion_runs", column: "attempt_count", definition: "INTEGER NOT NULL DEFAULT 1"},
	{table: "ingestion_runs", column: "failure_artifact_key", definition: "TEXT"},
	{table: "ingestion_runs", column: "diagnostics_json", definition: "TEXT NOT NULL DEFAULT '{}'"},
	{table: "properties", column: "source_id", definition: "TEXT"},
	{table: "properties", column: "browser_enabled", definition: "INTEGER NOT NULL DEFAULT 0"},
	{table: "properties", column: "request_headers_json", definition: "TEXT NOT NULL DEFAULT '{}'"},
	{table: "properties", column: "schedule_interval_seconds", definition: "INTEGER NOT NULL DEFAULT 0"},
	{table: "properties", column: "retry_max_attempts", definition: "INTEGER NOT NULL DEFAULT 1"},
	{table: "properties", column: "retry_backoff_millis", definition: "INTEGER NOT NULL DEFAULT 500"},
	{table: "properties", column: "paused", definition: "INTEGER NOT NULL DEFAULT 0"},
	{table: "properties", column: "pause_reason", definition: "TEXT NOT NULL DEFAULT ''"},
	{table: "properties", column: "metadata_json", definition: "TEXT NOT NULL DEFAULT '{}'"},
	{table: "properties", column: "last_run_at", definition: "TEXT"},
	{table: "properties", column: "next_run_at", definition: "TEXT"},
	{table: "property_extraction_configs", column: "change_summary", definition: "TEXT NOT NULL DEFAULT ''"},
	{table: "field_definitions", column: "default_value", definition: "TEXT NOT NULL DEFAULT ''"},
	{table: "field_definitions", column: "use_default_when_missing", definition: "INTEGER NOT NULL DEFAULT 0"},
	{table: "field_definitions", column: "comparison_operator", definition: "TEXT NOT NULL DEFAULT ''"},
	{table: "field_definitions", column: "comparison_value", definition: "TEXT NOT NULL DEFAULT ''"},
}

var defaultFieldDefinitions = []ingestiondomain.FieldDefinition{
	{
		ID:            "field-price",
		Name:          "price",
		DisplayName:   "Price",
		DataType:      ingestiondomain.FieldDataTypeNumber,
		Unit:          "€",
		SystemDefined: true,
	},
	{
		ID:            "field-rooms",
		Name:          "rooms",
		DisplayName:   "Rooms",
		DataType:      ingestiondomain.FieldDataTypeNumber,
		SystemDefined: true,
	},
	{
		ID:            "field-bathrooms",
		Name:          "bathrooms",
		DisplayName:   "Bathrooms",
		DataType:      ingestiondomain.FieldDataTypeNumber,
		SystemDefined: true,
	},
	{
		ID:            "field-area-m2",
		Name:          "area_m2",
		DisplayName:   "Area",
		DataType:      ingestiondomain.FieldDataTypeNumber,
		Unit:          "m²",
		SystemDefined: true,
	},
	{
		ID:            "field-title",
		Name:          "title",
		DisplayName:   "Title",
		DataType:      ingestiondomain.FieldDataTypeString,
		SystemDefined: true,
	},
	{
		ID:            "field-location",
		Name:          "location",
		DisplayName:   "Location",
		DataType:      ingestiondomain.FieldDataTypeString,
		SystemDefined: true,
	},
}

func seedFieldDefinitions(ctx context.Context, db *sql.DB) error {
	now := time.Now().UTC().Format(time.RFC3339Nano)
	for _, field := range defaultFieldDefinitions {
		enumJSON, _ := json.Marshal(field.EnumValues)
		if _, err := db.ExecContext(
			ctx,
			`INSERT INTO field_definitions (id, name, display_name, data_type, unit, description, enum_values_json, default_value, use_default_when_missing, comparison_operator, comparison_value, system_defined, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
				name = excluded.name,
				display_name = excluded.display_name,
				data_type = excluded.data_type,
				unit = excluded.unit,
				description = excluded.description,
				enum_values_json = excluded.enum_values_json,
				default_value = excluded.default_value,
				use_default_when_missing = excluded.use_default_when_missing,
				comparison_operator = excluded.comparison_operator,
				comparison_value = excluded.comparison_value,
				system_defined = excluded.system_defined,
				updated_at = excluded.updated_at`,
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
			now,
			now,
		); err != nil {
			return fmt.Errorf("seed field definitions: %w", err)
		}
	}

	return nil
}

func prepareSystemFieldDefinitionsForSeed(ctx context.Context, db *sql.DB) error {
	type existingFieldDefinition struct {
		id   string
		name string
	}

	rows, err := db.QueryContext(ctx, `SELECT id, name FROM field_definitions WHERE system_defined = 1`)
	if err != nil {
		return fmt.Errorf("query system field definitions for seed preparation: %w", err)
	}
	defer rows.Close()

	byName := make(map[string]existingFieldDefinition)
	for rows.Next() {
		var item existingFieldDefinition
		if err := rows.Scan(&item.id, &item.name); err != nil {
			return fmt.Errorf("scan system field definition for seed preparation: %w", err)
		}
		byName[strings.ToLower(strings.TrimSpace(item.name))] = item
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate system field definitions for seed preparation: %w", err)
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	for _, field := range defaultFieldDefinitions {
		existing, ok := byName[strings.ToLower(field.Name)]
		if !ok || existing.id == field.ID {
			continue
		}

		if _, err := db.ExecContext(
			ctx,
			`UPDATE field_definitions SET name = ?, updated_at = ? WHERE id = ?`,
			legacySystemFieldDefinitionName(field.Name, existing.id),
			now,
			existing.id,
		); err != nil {
			return fmt.Errorf("rename legacy system field definition %q from %q: %w", field.Name, existing.id, err)
		}
	}

	return nil
}

func reconcilePropertyFieldDefinitionReferences(ctx context.Context, db *sql.DB) error {
	fieldDefinitions, err := loadFieldDefinitionMap(ctx, db)
	if err != nil {
		return err
	}

	type storedPropertyFieldValue struct {
		id                string
		fieldDefinitionID sql.NullString
		fieldName         string
		valueText         string
	}

	rows, err := db.QueryContext(ctx, `SELECT id, field_definition_id, field_name, value_text FROM property_field_values WHERE TRIM(field_name) != ''`)
	if err != nil {
		return fmt.Errorf("query property field values for reconciliation: %w", err)
	}
	defer rows.Close()

	items := make([]storedPropertyFieldValue, 0)
	for rows.Next() {
		var item storedPropertyFieldValue
		if err := rows.Scan(&item.id, &item.fieldDefinitionID, &item.fieldName, &item.valueText); err != nil {
			return fmt.Errorf("scan property field value for reconciliation: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate property field values for reconciliation: %w", err)
	}

	for _, item := range items {
		definition, ok := fieldDefinitions[strings.ToLower(strings.TrimSpace(item.fieldName))]
		if !ok {
			continue
		}

		currentFieldDefinitionID := strings.TrimSpace(item.fieldDefinitionID.String)
		if item.fieldDefinitionID.Valid && currentFieldDefinitionID == definition.ID && strings.EqualFold(strings.TrimSpace(item.fieldName), definition.Name) {
			continue
		}

		valueText := applyFieldDefinitionFallback(definition, item.valueText)
		valueText = applyFieldDefinitionComparison(definition, valueText)
		validationStatus, validationMessage := ingestiondomain.ValidateFieldValue(definition, valueText)
		if _, err := db.ExecContext(
			ctx,
			`UPDATE property_field_values
			 SET field_definition_id = ?, field_name = ?, value_text = ?, validation_status = ?, validation_message = ?
			 WHERE id = ?`,
			definition.ID,
			definition.Name,
			valueText,
			validationStatus,
			validationMessage,
			item.id,
		); err != nil {
			return fmt.Errorf("reconcile property field definition reference: %w", err)
		}
	}

	return nil
}

func cleanupLegacySystemFieldDefinitions(ctx context.Context, db *sql.DB) error {
	if _, err := db.ExecContext(ctx, `DELETE FROM field_definitions WHERE system_defined = 1 AND name LIKE '__legacy__%'`); err != nil {
		return fmt.Errorf("delete legacy system field definitions: %w", err)
	}

	return nil
}

func legacySystemFieldDefinitionName(name, id string) string {
	return fmt.Sprintf("__legacy__%s__%s", strings.ToLower(strings.TrimSpace(name)), strings.ToLower(strings.TrimSpace(id)))
}

func backfillPropertyFieldValues(ctx context.Context, db *sql.DB) error {
	fieldDefinitions, err := loadFieldDefinitionMap(ctx, db)
	if err != nil {
		return err
	}

	type configKey struct {
		propertyID string
		version    int
	}

	type snapshotBackfill struct {
		snapshotID    string
		propertyID    string
		configVersion int
		observedAt    string
		valuesJSON    string
	}

	configMappings := make(map[configKey]map[string]string)
	configRows, err := db.QueryContext(ctx, `SELECT property_id, version, fields_json FROM property_extraction_configs`)
	if err != nil {
		return fmt.Errorf("query property configs for field backfill: %w", err)
	}
	defer configRows.Close()

	for configRows.Next() {
		var propertyID string
		var version int
		var fieldsJSON string
		if err := configRows.Scan(&propertyID, &version, &fieldsJSON); err != nil {
			return fmt.Errorf("scan property config for field backfill: %w", err)
		}

		var selectors []ingestiondomain.FieldSelector
		if err := json.Unmarshal([]byte(fieldsJSON), &selectors); err != nil {
			continue
		}

		mapping := make(map[string]string, len(selectors))
		for _, selector := range selectors {
			name := strings.TrimSpace(selector.Name)
			if name == "" {
				continue
			}
			mapping[name] = strings.TrimSpace(selector.FieldName)
		}
		configMappings[configKey{propertyID: propertyID, version: version}] = mapping
	}
	if err := configRows.Err(); err != nil {
		return fmt.Errorf("iterate property configs for field backfill: %w", err)
	}

	rows, err := db.QueryContext(ctx, `SELECT id, property_id, config_version, observed_at, values_json FROM property_snapshots`)
	if err != nil {
		return fmt.Errorf("query property snapshots for field backfill: %w", err)
	}

	var snapshots []snapshotBackfill
	for rows.Next() {
		var snapshot snapshotBackfill
		if err := rows.Scan(&snapshot.snapshotID, &snapshot.propertyID, &snapshot.configVersion, &snapshot.observedAt, &snapshot.valuesJSON); err != nil {
			_ = rows.Close()
			return fmt.Errorf("scan property snapshot for field backfill: %w", err)
		}
		snapshots = append(snapshots, snapshot)
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return err
	}
	if err := rows.Close(); err != nil {
		return fmt.Errorf("close property snapshot rows for field backfill: %w", err)
	}

	for _, snapshot := range snapshots {
		values := map[string]string{}
		if err := json.Unmarshal([]byte(normalizeJSONString(snapshot.valuesJSON)), &values); err != nil {
			continue
		}

		mapping := configMappings[configKey{propertyID: snapshot.propertyID, version: snapshot.configVersion}]
		for selectorName, value := range values {
			fieldName := strings.TrimSpace(mapping[selectorName])
			fieldID := ""
			validationStatus := ingestiondomain.FieldValidationStatusUnmapped
			validationMessage := ""
			if definition, ok := fieldDefinitions[strings.ToLower(fieldName)]; ok {
				fieldID = definition.ID
				validationStatus, validationMessage = ingestiondomain.ValidateFieldValue(definition, value)
			}
			if _, err := db.ExecContext(
				ctx,
				`INSERT OR IGNORE INTO property_field_values
					(id, property_id, snapshot_id, field_definition_id, field_name, selector_name, config_version, value_text, observed_at, validation_status, validation_message, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				fmt.Sprintf("%s:%s", snapshot.snapshotID, selectorName),
				snapshot.propertyID,
				snapshot.snapshotID,
				nullableString(fieldID),
				fieldName,
				selectorName,
				snapshot.configVersion,
				value,
				snapshot.observedAt,
				validationStatus,
				validationMessage,
				snapshot.observedAt,
			); err != nil {
				return fmt.Errorf("backfill property field value: %w", err)
			}
		}
	}

	return nil
}

func loadFieldDefinitionMap(ctx context.Context, db *sql.DB) (map[string]ingestiondomain.FieldDefinition, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, name, display_name, data_type, unit, description, enum_values_json, default_value, use_default_when_missing, comparison_operator, comparison_value, system_defined, created_at, updated_at FROM field_definitions`)
	if err != nil {
		return nil, fmt.Errorf("query field definitions: %w", err)
	}
	defer rows.Close()

	items := make(map[string]ingestiondomain.FieldDefinition)
	for rows.Next() {
		field, err := scanFieldDefinition(rows)
		if err != nil {
			return nil, err
		}
		items[strings.ToLower(field.Name)] = field
	}

	return items, rows.Err()
}
