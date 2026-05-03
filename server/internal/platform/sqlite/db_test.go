package sqlite

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	ingestiondomain "nido/server/internal/ingestion/domain"
	"nido/server/internal/platform/config"
)

func TestOpenRecoversCorruptDatabaseFile(t *testing.T) {
	t.Parallel()

	databasePath := filepath.Join(t.TempDir(), "nido.db")
	corruptContents := []byte("this is not a sqlite database")
	if err := os.WriteFile(databasePath, corruptContents, 0o644); err != nil {
		t.Fatalf("write corrupt database: %v", err)
	}

	db, err := Open(context.Background(), config.DatabaseConfig{Path: databasePath})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate database: %v", err)
	}

	backups, err := filepath.Glob(databasePath + ".corrupt-*")
	if err != nil {
		t.Fatalf("glob backup databases: %v", err)
	}
	if len(backups) != 1 {
		t.Fatalf("expected exactly one corrupt database backup, got %v", backups)
	}

	backupContents, err := os.ReadFile(backups[0])
	if err != nil {
		t.Fatalf("read backup database: %v", err)
	}
	if string(backupContents) != string(corruptContents) {
		t.Fatalf("unexpected backup contents: %q", string(backupContents))
	}

	var tableCount int
	if err := db.QueryRowContext(
		context.Background(),
		"SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'users'",
	).Scan(&tableCount); err != nil {
		t.Fatalf("query sqlite schema: %v", err)
	}
	if tableCount != 1 {
		t.Fatalf("expected migrated users table, got %d matches", tableCount)
	}
}

func TestBackupDatabaseCreatesVersionedRestorableFile(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	databasePath := filepath.Join(t.TempDir(), "nido.db")
	db, err := Open(ctx, config.DatabaseConfig{Path: databasePath})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()
	if err := Migrate(ctx, db); err != nil {
		t.Fatalf("migrate database: %v", err)
	}
	execTestStatement(t, db, `INSERT INTO sources (id, name, kind, endpoint_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, "source-1", "Source", "http-json-feed", "https://example.test/feed.json", time.Now().UTC().Format(time.RFC3339Nano), time.Now().UTC().Format(time.RFC3339Nano))

	backupPath, err := BackupDatabase(ctx, db, filepath.Join(t.TempDir(), "backups"), SchemaVersion)
	if err != nil {
		t.Fatalf("backup database: %v", err)
	}
	if filepath.Ext(backupPath) != ".dump" {
		t.Fatalf("expected .dump backup, got %s", backupPath)
	}

	restored, err := Open(ctx, config.DatabaseConfig{Path: backupPath})
	if err != nil {
		t.Fatalf("open backup database: %v", err)
	}
	defer restored.Close()
	assertTableCount(t, restored, "sources", 1)
}

func TestMigrateMarksSchemaVersion(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db, err := Open(ctx, config.DatabaseConfig{Path: filepath.Join(t.TempDir(), "nido.db")})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	if err := Migrate(ctx, db); err != nil {
		t.Fatalf("migrate database: %v", err)
	}
	version, err := CurrentSchemaVersion(ctx, db)
	if err != nil {
		t.Fatalf("current schema version: %v", err)
	}
	if version != SchemaVersion {
		t.Fatalf("expected schema version %d, got %d", SchemaVersion, version)
	}
}

func TestResetWorkspaceClearsDataTransactionally(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db, err := Open(ctx, config.DatabaseConfig{Path: filepath.Join(t.TempDir(), "nido.db")})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()
	if err := Migrate(ctx, db); err != nil {
		t.Fatalf("migrate database: %v", err)
	}
	createdAt := time.Now().UTC().Format(time.RFC3339Nano)
	execTestStatement(t, db, `INSERT INTO sources (id, name, kind, endpoint_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, "source-1", "Source", "http-json-feed", "https://example.test/feed.json", createdAt, createdAt)
	execTestStatement(t, db, `INSERT INTO properties (id, url, label, source_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, "property-1", "https://example.test/property/1", "Property", "source-1", createdAt, createdAt)

	if err := NewStore(db).ResetWorkspace(ctx); err != nil {
		t.Fatalf("reset workspace: %v", err)
	}
	assertTableCount(t, db, "sources", 0)
	assertTableCount(t, db, "properties", 0)
	assertTableCount(t, db, "platform_settings", 0)
}

func TestMigrateBackfillsPropertyFieldValuesOnExistingSnapshots(t *testing.T) {
	t.Parallel()

	databasePath := filepath.Join(t.TempDir(), "nido.db")
	db, err := Open(context.Background(), config.DatabaseConfig{Path: databasePath})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("initial migrate database: %v", err)
	}

	observedAt := time.Now().UTC().Format(time.RFC3339Nano)
	execTestStatement(t, db, `
		INSERT INTO properties (id, url, label, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`, "property-1", "https://example.test/property/1", "Test Property", observedAt, observedAt)
	execTestStatement(t, db, `
		INSERT INTO property_extraction_configs (id, property_id, fields_json, version, created_at, change_summary)
		VALUES (?, ?, ?, ?, ?, ?)
	`, "config-1", "property-1", `[{"name":"price","field_name":"price"}]`, 1, observedAt, "")
	execTestStatement(t, db, `
		INSERT INTO property_snapshots (id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, "snapshot-1", "property-1", 1, observedAt, `{"price":"123000"}`, `{}`, 1, sql.NullString{})

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("rerun migrate database: %v", err)
	}

	var fieldName string
	var fieldDefinitionID sql.NullString
	var valueText string
	if err := db.QueryRowContext(
		context.Background(),
		`SELECT field_name, field_definition_id, value_text FROM property_field_values WHERE id = ?`,
		"snapshot-1:price",
	).Scan(&fieldName, &fieldDefinitionID, &valueText); err != nil {
		t.Fatalf("query backfilled property field value: %v", err)
	}

	if fieldName != "price" {
		t.Fatalf("expected field name price, got %q", fieldName)
	}
	if !fieldDefinitionID.Valid || fieldDefinitionID.String != "field-price" {
		t.Fatalf("expected field definition id field-price, got %+v", fieldDefinitionID)
	}
	if valueText != "123000" {
		t.Fatalf("expected value text 123000, got %q", valueText)
	}
}

func TestListAnalyticsRecordsAllowsNullSourceID(t *testing.T) {
	t.Parallel()

	databasePath := filepath.Join(t.TempDir(), "nido.db")
	db, err := Open(context.Background(), config.DatabaseConfig{Path: databasePath})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate database: %v", err)
	}

	store := NewStore(db)
	observedAt := time.Now().UTC().Format(time.RFC3339Nano)
	execTestStatement(t, db, `
		INSERT INTO properties (id, url, label, source_id, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, "property-null-source", "https://example.test/property/null-source", "Unassigned property", sql.NullString{}, "pending", observedAt, observedAt)
	execTestStatement(t, db, `
		INSERT INTO property_snapshots (id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, "snapshot-null-source", "property-null-source", 1, observedAt, `{"price":"190000"}`, `{}`, 1, sql.NullString{})
	execTestStatement(t, db, `
		INSERT INTO property_field_values
			(id, property_id, snapshot_id, field_definition_id, field_name, selector_name, config_version, value_text, observed_at, validation_status, validation_message, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, "snapshot-null-source:price", "property-null-source", "snapshot-null-source", "field-price", "price", "price", 1, "190000", observedAt, ingestiondomain.FieldValidationStatusValid, "", observedAt)

	records, err := store.ListAnalyticsRecords(context.Background())
	if err != nil {
		t.Fatalf("list analytics records: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected one analytics record, got %d", len(records))
	}

	record := records[0]
	if record.PropertyID != "property-null-source" {
		t.Fatalf("expected property-null-source record, got %q", record.PropertyID)
	}
	if record.SourceID != "" {
		t.Fatalf("expected empty source id for partially configured property, got %q", record.SourceID)
	}
	if got := record.Values["price"]; got != "190000" {
		t.Fatalf("expected analytics price 190000, got %q", got)
	}
}

func TestListBookmarksAllowsNullSourceID(t *testing.T) {
	t.Parallel()

	databasePath := filepath.Join(t.TempDir(), "nido.db")
	db, err := Open(context.Background(), config.DatabaseConfig{Path: databasePath})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate database: %v", err)
	}

	store := NewStore(db)
	createdAt := time.Now().UTC().Format(time.RFC3339Nano)
	execTestStatement(t, db, `
		INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, "user-1", "user@example.test", "Test User", "hash", createdAt, createdAt)
	execTestStatement(t, db, `
		INSERT INTO properties (id, url, label, source_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, "property-1", "https://example.test/property/1", "Property Without Source", sql.NullString{}, createdAt, createdAt)
	execTestStatement(t, db, `
		INSERT INTO bookmarks (user_id, property_id, created_at)
		VALUES (?, ?, ?)
	`, "user-1", "property-1", createdAt)

	items, err := store.ListBookmarks(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("list bookmarks: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one bookmark, got %d", len(items))
	}
	if items[0].SourceID != "" {
		t.Fatalf("expected empty source id for bookmarked property without source, got %q", items[0].SourceID)
	}
}

func TestMigratePreservesEngagementDataOnRerun(t *testing.T) {
	t.Parallel()

	databasePath := filepath.Join(t.TempDir(), "nido.db")
	db, err := Open(context.Background(), config.DatabaseConfig{Path: databasePath})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("initial migrate database: %v", err)
	}

	createdAt := time.Now().UTC().Format(time.RFC3339Nano)
	execTestStatement(t, db, `
		INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, "user-1", "user@example.test", "Test User", "hash", createdAt, createdAt)
	execTestStatement(t, db, `
		INSERT INTO properties (id, url, label, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`, "property-1", "https://example.test/property/1", "Preserved Property", createdAt, createdAt)
	execTestStatement(t, db, `
		INSERT INTO bookmarks (user_id, property_id, created_at)
		VALUES (?, ?, ?)
	`, "user-1", "property-1", createdAt)
	execTestStatement(t, db, `
		INSERT INTO alert_rules (id, user_id, property_id, rule_type, threshold_amount, enabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, "alert-1", "user-1", "property-1", "price_below", 100000, 1, createdAt, createdAt)
	execTestStatement(t, db, `
		INSERT INTO notifications (id, user_id, alert_id, property_id, kind, title, body, data_json, delivery_status, created_at, read_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, "notification-1", "user-1", "alert-1", "property-1", "price_below", "Price below target", "Property is below target", `{}`, "pending", createdAt, sql.NullString{})

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("rerun migrate database: %v", err)
	}

	assertTableCount(t, db, "bookmarks", 1)
	assertTableCount(t, db, "alert_rules", 1)
	assertTableCount(t, db, "notifications", 1)
}

func TestMigrateRepairsLegacyRoomsFieldDefinitionIDs(t *testing.T) {
	t.Parallel()

	databasePath := filepath.Join(t.TempDir(), "nido.db")
	db, err := Open(context.Background(), config.DatabaseConfig{Path: databasePath})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("initial migrate database: %v", err)
	}

	observedAt := time.Now().UTC().Format(time.RFC3339Nano)
	execTestStatement(t, db, `DELETE FROM field_definitions WHERE id = ?`, "field-rooms")
	execTestStatement(t, db, `UPDATE field_definitions SET name = ?, display_name = ?, updated_at = ? WHERE id = ?`, "rooms", "Rooms", observedAt, "field-bathrooms")
	execTestStatement(t, db, `
		INSERT INTO properties (id, url, label, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`, "property-legacy-rooms", "https://example.test/property/legacy-rooms", "Legacy Rooms Property", observedAt, observedAt)
	execTestStatement(t, db, `
		INSERT INTO property_snapshots (id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, "snapshot-legacy-rooms", "property-legacy-rooms", 1, observedAt, `{"rooms":"3"}`, `{}`, 1, sql.NullString{})
	execTestStatement(t, db, `
		INSERT INTO property_field_values
			(id, property_id, snapshot_id, field_definition_id, field_name, selector_name, config_version, value_text, observed_at, validation_status, validation_message, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, "snapshot-legacy-rooms:rooms", "property-legacy-rooms", "snapshot-legacy-rooms", "field-bathrooms", "rooms", "rooms", 1, "3", observedAt, ingestiondomain.FieldValidationStatusValid, "", observedAt)

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("rerun migrate database: %v", err)
	}

	var roomsName string
	if err := db.QueryRowContext(context.Background(), `SELECT name FROM field_definitions WHERE id = ?`, "field-rooms").Scan(&roomsName); err != nil {
		t.Fatalf("query repaired rooms field definition: %v", err)
	}
	if roomsName != "rooms" {
		t.Fatalf("expected canonical rooms field definition, got %q", roomsName)
	}

	var bathroomsName string
	if err := db.QueryRowContext(context.Background(), `SELECT name FROM field_definitions WHERE id = ?`, "field-bathrooms").Scan(&bathroomsName); err != nil {
		t.Fatalf("query repaired bathrooms field definition: %v", err)
	}
	if bathroomsName != "bathrooms" {
		t.Fatalf("expected canonical bathrooms field definition, got %q", bathroomsName)
	}

	var fieldDefinitionID string
	var fieldName string
	if err := db.QueryRowContext(
		context.Background(),
		`SELECT field_definition_id, field_name FROM property_field_values WHERE id = ?`,
		"snapshot-legacy-rooms:rooms",
	).Scan(&fieldDefinitionID, &fieldName); err != nil {
		t.Fatalf("query repaired property field value: %v", err)
	}
	if fieldDefinitionID != "field-rooms" {
		t.Fatalf("expected property field value to reference field-rooms, got %q", fieldDefinitionID)
	}
	if fieldName != "rooms" {
		t.Fatalf("expected property field name rooms, got %q", fieldName)
	}

	records, err := NewStore(db).ListAnalyticsRecords(context.Background())
	if err != nil {
		t.Fatalf("list analytics records after legacy field repair: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected one analytics record after legacy field repair, got %d", len(records))
	}
	if got := records[0].Values["rooms"]; got != "3" {
		t.Fatalf("expected repaired analytics rooms value 3, got %q", got)
	}
}

func TestMigratePreservesPropertyHistoryStateOnRerun(t *testing.T) {
	t.Parallel()

	databasePath := filepath.Join(t.TempDir(), "nido.db")
	db, err := Open(context.Background(), config.DatabaseConfig{Path: databasePath})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("initial migrate database: %v", err)
	}

	store := NewStore(db)
	observedAt := time.Now().UTC().Format(time.RFC3339Nano)
	execTestStatement(t, db, `
		INSERT INTO properties (id, url, label, status, last_run_at, next_run_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, "property-history", "https://example.test/property/history", "History Property", "active", observedAt, observedAt, observedAt, observedAt)
	execTestStatement(t, db, `
		INSERT INTO property_snapshots (id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, "snapshot-history", "property-history", 2, observedAt, `{"price":"199000","rooms":"3"}`, `{"price":true}`, 1, sql.NullString{})
	execTestStatement(t, db, `
		INSERT INTO property_runs (id, property_id, status, trigger_kind, attempt_count, max_attempts, started_at, finished_at, error_message, snapshot_id, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, "run-history", "property-history", "success", ingestiondomain.TriggerKindManual, 1, 1, observedAt, observedAt, "", "snapshot-history", observedAt)

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("rerun migrate database: %v", err)
	}

	assertTableCount(t, db, "properties", 1)
	assertTableCount(t, db, "property_snapshots", 1)
	assertTableCount(t, db, "property_runs", 1)

	snapshots, err := store.ListPropertySnapshots(context.Background(), "property-history", 10)
	if err != nil {
		t.Fatalf("list property snapshots after rerun migrate: %v", err)
	}
	if len(snapshots) != 1 {
		t.Fatalf("expected one property snapshot after rerun migrate, got %d", len(snapshots))
	}
	if got := decodeSnapshotValues(string(snapshots[0].Values))["price"]; got != "199000" {
		t.Fatalf("expected preserved snapshot price 199000, got %q", got)
	}

	runs, err := store.ListPropertyRuns(context.Background(), "property-history", 10)
	if err != nil {
		t.Fatalf("list property runs after rerun migrate: %v", err)
	}
	if len(runs) != 1 {
		t.Fatalf("expected one property run after rerun migrate, got %d", len(runs))
	}
	if runs[0].TriggerKind != ingestiondomain.TriggerKindManual {
		t.Fatalf("expected preserved trigger kind %q, got %q", ingestiondomain.TriggerKindManual, runs[0].TriggerKind)
	}
	if runs[0].SnapshotID != "snapshot-history" {
		t.Fatalf("expected preserved snapshot id snapshot-history, got %q", runs[0].SnapshotID)
	}
}

func assertTableCount(t *testing.T, db *sql.DB, tableName string, want int) {
	t.Helper()

	var got int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM `+tableName).Scan(&got); err != nil {
		t.Fatalf("count rows in %s: %v", tableName, err)
	}
	if got != want {
		t.Fatalf("expected %d rows in %s, got %d", want, tableName, got)
	}
}

func execTestStatement(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()

	if _, err := db.ExecContext(context.Background(), query, args...); err != nil {
		t.Fatalf("exec statement %q: %v", query, err)
	}
}
