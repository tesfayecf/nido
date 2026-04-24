package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"

	"home-searcher/server/internal/platform/config"
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

DROP TABLE IF EXISTS watchlists;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS alert_rules;
DROP TABLE IF EXISTS bookmarks;
DROP TABLE IF EXISTS price_events;
DROP TABLE IF EXISTS listing_snapshots;
DROP TABLE IF EXISTS listings;

CREATE TABLE IF NOT EXISTS bookmarks (
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY(property_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);

CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL,
    threshold_amount INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled, rule_type);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

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

CREATE TABLE IF NOT EXISTS property_metadata (
    property_id TEXT PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
    workflow_state TEXT NOT NULL DEFAULT 'unreviewed',
    priority TEXT NOT NULL DEFAULT 'medium',
    pipeline_stage TEXT NOT NULL DEFAULT '',
    target_price REAL,
    expected_yield REAL,
    acquisition_notes TEXT NOT NULL DEFAULT '',
    deal_thesis TEXT NOT NULL DEFAULT '',
    external_references_json TEXT NOT NULL DEFAULT '[]',
    attachments_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_property_metadata_priority ON property_metadata(priority);
CREATE INDEX IF NOT EXISTS idx_property_metadata_workflow_state ON property_metadata(workflow_state);

DROP TABLE IF EXISTS property_watchers;
DROP TABLE IF EXISTS property_comments;

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    target_kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target_created ON audit_logs(target_kind, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS integration_configs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    target TEXT NOT NULL,
    filters_json TEXT NOT NULL DEFAULT '{}',
    active INTEGER NOT NULL DEFAULT 1,
    retry_max_attempts INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_test_status TEXT NOT NULL DEFAULT '',
    last_test_at TEXT
);

CREATE TABLE IF NOT EXISTS integration_deliveries (
    id TEXT PRIMARY KEY,
    integration_id TEXT NOT NULL REFERENCES integration_configs(id) ON DELETE CASCADE,
    property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
    trigger_kind TEXT NOT NULL,
    status TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL DEFAULT '{}',
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_deliveries_created ON integration_deliveries(created_at DESC);

CREATE TABLE IF NOT EXISTS scheduler_pauses (
    id TEXT PRIMARY KEY,
    scope_type TEXT NOT NULL,
    scope_value TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduler_pauses_scope ON scheduler_pauses(scope_type, scope_value);

CREATE TABLE IF NOT EXISTS maintenance_windows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_range ON maintenance_windows(starts_at, ends_at);
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
	{table: "properties", column: "last_run_at", definition: "TEXT"},
	{table: "properties", column: "next_run_at", definition: "TEXT"},
	{table: "property_extraction_configs", column: "change_summary", definition: "TEXT NOT NULL DEFAULT ''"},
}
