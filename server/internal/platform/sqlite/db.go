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
            cid       int
            name      string
            dataType  string
            notNull   int
            defaultV  sql.NullString
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
    created_at TEXT NOT NULL
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
	{table: "properties", column: "schedule_interval_seconds", definition: "INTEGER NOT NULL DEFAULT 0"},
	{table: "properties", column: "retry_max_attempts", definition: "INTEGER NOT NULL DEFAULT 1"},
	{table: "properties", column: "retry_backoff_millis", definition: "INTEGER NOT NULL DEFAULT 500"},
	{table: "properties", column: "last_run_at", definition: "TEXT"},
	{table: "properties", column: "next_run_at", definition: "TEXT"},
}
