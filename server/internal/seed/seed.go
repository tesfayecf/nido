/**
 * File: internal/seed/seed.go
 *
 * Purpose:
 * Implements backend behavior for the seed package.
 *
 * Responsibilities:
 * - Provide package-specific backend behavior
 * - Keep dependencies explicit
 * - Return deterministic values to callers
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - context
 * - database/sql
 * - encoding/json
 * - errors
 * - fmt
 * - os
 * - regexp
 * - strings
 * - time
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package seed

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"
)

// ErrProductionEnvironment prevents development data from being written in production.
var ErrProductionEnvironment = errors.New("seed data is disabled in production environments")

/**
 * Purpose:
 * Defines the Options struct used by this package and its consumers.
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
type Options struct {
	Variant string
	Now     time.Time
	Env     string
}

/**
 * Purpose:
 * Defines the seedData struct used by this package and its consumers.
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
type seedData struct {
	prefix string
	now    time.Time
}

var variantPattern = regexp.MustCompile(`[^a-z0-9-]+`)

/**
 * Purpose:
 * Performs the Environment operation for this backend package.
 *
 * Parameters:
 * - None.
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
func Environment() string {
	for _, name := range []string{"NIDO_ENV", "APP_ENV", "ENVIRONMENT", "GO_ENV"} {
		if value := strings.TrimSpace(os.Getenv(name)); value != "" {
			return strings.ToLower(value)
		}
	}
	return "development"
}

/**
 * Purpose:
 * Performs the IsProduction operation for this backend package.
 *
 * Parameters:
 * - env string
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
func IsProduction(env string) bool {
	normalized := strings.ToLower(strings.TrimSpace(env))
	return normalized == "prod" || normalized == "production"
}

/**
 * Purpose:
 * Performs the Apply operation for this backend package.
 *
 * Parameters:
 * - ctx context.Context, db *sql.DB, options Options
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
func Apply(ctx context.Context, db *sql.DB, options Options) error {
	env := options.Env
	if env == "" {
		env = Environment()
	}
	if IsProduction(env) {
		return ErrProductionEnvironment
	}

	now := options.Now
	if now.IsZero() {
		now = time.Date(2026, 1, 15, 12, 0, 0, 0, time.UTC)
	}
	now = now.UTC()

	variant := normalizeVariant(options.Variant)
	data := seedData{
		prefix: "seed-" + variant,
		now:    now,
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin seed transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if err := data.reset(ctx, tx); err != nil {
		return err
	}
	if err := data.insert(ctx, tx); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit seed transaction: %w", err)
	}

	return nil
}

/**
 * Purpose:
 * Performs the normalizeVariant operation for this backend package.
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
func normalizeVariant(raw string) string {
	normalized := strings.ToLower(strings.TrimSpace(raw))
	if normalized == "" {
		return "default"
	}
	normalized = strings.ReplaceAll(normalized, "_", "-")
	normalized = variantPattern.ReplaceAllString(normalized, "-")
	normalized = strings.Trim(normalized, "-")
	if normalized == "" {
		return "default"
	}
	return normalized
}

/**
 * Purpose:
 * Performs the reset operation for this backend package.
 *
 * Parameters:
 * - d seedData
 *
 * Returns:
 * - reset(ctx context.Context, tx *sql.Tx) error
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
func (d seedData) reset(ctx context.Context, tx *sql.Tx) error {
	for _, statement := range []string{
		`DELETE FROM integration_delivery_logs WHERE id LIKE ?`,
		`DELETE FROM notifications WHERE id LIKE ? OR user_id LIKE ? OR property_id LIKE ?`,
		`DELETE FROM alert_rules WHERE id LIKE ? OR user_id LIKE ? OR property_id LIKE ?`,
		`DELETE FROM bookmarks WHERE user_id LIKE ? OR property_id LIKE ?`,
		`DELETE FROM property_field_values WHERE id LIKE ? OR property_id LIKE ? OR snapshot_id LIKE ?`,
		`DELETE FROM property_runs WHERE id LIKE ? OR property_id LIKE ? OR snapshot_id LIKE ?`,
		`DELETE FROM property_snapshots WHERE id LIKE ? OR property_id LIKE ?`,
		`DELETE FROM property_extraction_configs WHERE id LIKE ? OR property_id LIKE ?`,
		`DELETE FROM property_tags WHERE property_id LIKE ? OR tag_id LIKE ?`,
		`DELETE FROM tags WHERE id LIKE ?`,
		`DELETE FROM properties WHERE id LIKE ? OR source_id LIKE ?`,
		`DELETE FROM ingestion_runs WHERE id LIKE ? OR source_id LIKE ?`,
		`DELETE FROM artifacts WHERE key LIKE ? OR source_id LIKE ? OR run_id LIKE ?`,
		`DELETE FROM sources WHERE id LIKE ?`,
		`DELETE FROM auth_sessions WHERE user_id LIKE ?`,
		`DELETE FROM users WHERE id LIKE ? OR email LIKE ?`,
	} {
		args := make([]any, strings.Count(statement, "?"))
		for i := range args {
			args[i] = d.like()
		}
		if _, err := tx.ExecContext(ctx, statement, args...); err != nil {
			return fmt.Errorf("reset seed data: %w", err)
		}
	}
	return nil
}

/**
 * Purpose:
 * Performs the insert operation for this backend package.
 *
 * Parameters:
 * - d seedData
 *
 * Returns:
 * - insert(ctx context.Context, tx *sql.Tx) error
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
func (d seedData) insert(ctx context.Context, tx *sql.Tx) error {
	created := formatTime(d.now)
	lastRun := formatTime(d.now.Add(-2 * time.Hour))
	nextRun := formatTime(d.now.Add(4 * time.Hour))

	sources := []struct {
		id, name, kind, endpoint, config string
		active, browser                  bool
		interval, freshness              int
	}{
		{d.id("src-public"), "Seed Public Listing Feed", "http-json-feed", "https://seed.local/public-feed.json", `{"items_path":"$.items","currency":"EUR"}`, true, false, 3600, 900},
		{d.id("src-partner"), "Seed Partner Portal", "html-listings", "https://seed.local/partner/listings", `{"item_selector":".listing","requires_browser":true}`, false, true, 0, 0},
	}
	for _, source := range sources {
		if _, err := tx.ExecContext(ctx, `INSERT INTO sources (
			id, name, kind, endpoint_url, config_json, browser_enabled, active,
			rate_limit_window_seconds, rate_limit_max_requests, retry_max_attempts, retry_backoff_millis,
			schedule_interval_seconds, freshness_window_seconds, next_run_at, last_run_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			source.id, source.name, source.kind, source.endpoint, compactJSON(source.config), boolInt(source.browser), boolInt(source.active),
			60, 30, 3, 750, source.interval, source.freshness, nextRun, lastRun, created, created,
		); err != nil {
			return fmt.Errorf("insert seed source %q: %w", source.id, err)
		}
	}

	properties := []struct {
		id, label, url, sourceID, status, metadata, pauseReason string
		paused                                                  bool
		interval                                                int
	}{
		{d.id("prop-bilbao-flat"), "Seed Bilbao riverside flat", "https://seed.local/properties/bilbao-flat", d.id("src-public"), "active", `{"priority_level":"high","business_stage":"due_diligence","target_price":245000,"expected_rent":1250,"expected_yield_bps":612,"acquisition_notes":"Recently renovated with stable rental comps.","deal_thesis":"Central location and below-target price.","external_references":[{"label":"CRM","value":"CRM-1001"}],"attachments":[{"label":"brochure","url":"https://seed.local/docs/bilbao-flat.pdf"}]}`, "", false, 1800},
		{d.id("prop-getxo-house"), "Seed Getxo family house", "https://seed.local/properties/getxo-house", d.id("src-public"), "pending", `{"priority_level":"medium","business_stage":"screening","target_price":395000,"expected_rent":1800,"expected_yield_bps":547}`, "", false, 3600},
		{d.id("prop-vitoria-loft"), "Seed Vitoria incomplete loft", "https://seed.local/properties/vitoria-loft", d.id("src-partner"), "degraded", `{"priority_level":"low","business_stage":"needs_research","target_price":175000}`, "", false, 0},
		{d.id("prop-donostia-studio"), "Seed Donostia paused studio", "https://seed.local/properties/donostia-studio", d.id("src-partner"), "inactive", `{"priority_level":"watch","business_stage":"paused","target_price":320000}`, "owner requested hold", true, 0},
	}
	for _, property := range properties {
		if _, err := tx.ExecContext(ctx, `INSERT INTO properties (
			id, url, label, source_id, browser_enabled, request_headers_json, status,
			schedule_interval_seconds, retry_max_attempts, retry_backoff_millis, paused, pause_reason,
			metadata_json, last_run_at, next_run_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			property.id, property.url, property.label, property.sourceID, 0, `{}`, property.status,
			property.interval, 3, 750, boolInt(property.paused), property.pauseReason, compactJSON(property.metadata),
			lastRun, nextRun, created, created,
		); err != nil {
			return fmt.Errorf("insert seed property %q: %w", property.id, err)
		}
	}

	tags := []struct {
		id, name, color string
	}{
		{d.id("tag-hot"), "Seed Hot Lead", "#dc2626"},
		{d.id("tag-yield"), "Seed Yield Candidate", "#16a34a"},
		{d.id("tag-review"), "Seed Needs Review", "#f59e0b"},
	}
	for _, tag := range tags {
		if _, err := tx.ExecContext(ctx, `INSERT INTO tags (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, tag.id, tag.name, tag.color, created, created); err != nil {
			return fmt.Errorf("insert seed tag %q: %w", tag.id, err)
		}
	}
	for _, assignment := range [][2]string{
		{d.id("prop-bilbao-flat"), d.id("tag-hot")},
		{d.id("prop-bilbao-flat"), d.id("tag-yield")},
		{d.id("prop-vitoria-loft"), d.id("tag-review")},
	} {
		if _, err := tx.ExecContext(ctx, `INSERT INTO property_tags (property_id, tag_id, assigned_at) VALUES (?, ?, ?)`, assignment[0], assignment[1], created); err != nil {
			return fmt.Errorf("insert seed property tag: %w", err)
		}
	}

	fields := compactJSON(`[{"name":"price","field_name":"price","selector_type":"css","selector_value":"[data-field='price']","extraction_mode":"text","text_mode":"innerText","required":true},{"name":"title","field_name":"title","selector_type":"css","selector_value":"h1","extraction_mode":"text","text_mode":"innerText","required":true},{"name":"location","field_name":"location","selector_type":"css","selector_value":"[data-field='location']","extraction_mode":"text","text_mode":"innerText","required":false},{"name":"rooms","field_name":"rooms","selector_type":"css","selector_value":"[data-field='rooms']","extraction_mode":"text","text_mode":"innerText","required":false}]`)
	for index, property := range properties {
		if _, err := tx.ExecContext(ctx, `INSERT INTO property_extraction_configs (id, property_id, fields_json, version, created_at, change_summary) VALUES (?, ?, ?, ?, ?, ?)`,
			d.id(fmt.Sprintf("cfg-%d", index+1)), property.id, fields, 1, created, "Seed baseline extraction configuration"); err != nil {
			return fmt.Errorf("insert seed property config: %w", err)
		}
	}

	snapshotRows := []struct {
		propertyID, values, flags, valid, errMsg string
	}{
		{d.id("prop-bilbao-flat"), `{"price":"239000","title":"Seed Bilbao riverside flat","location":"Bilbao","rooms":"3"}`, `{"price":"decreased"}`, "1", ""},
		{d.id("prop-getxo-house"), `{"price":"410000","title":"Seed Getxo family house","location":"Getxo","rooms":"4"}`, `{}`, "1", ""},
		{d.id("prop-vitoria-loft"), `{"title":"Seed Vitoria incomplete loft","location":"Vitoria-Gasteiz"}`, `{"price":"missing"}`, "0", "required price field missing"},
	}
	for index, snapshot := range snapshotRows {
		snapshotID := d.id(fmt.Sprintf("snap-%d", index+1))
		if _, err := tx.ExecContext(ctx, `INSERT INTO property_snapshots (id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			snapshotID, snapshot.propertyID, 1, formatTime(d.now.Add(time.Duration(index)*time.Minute)), compactJSON(snapshot.values), compactJSON(snapshot.flags), snapshot.valid, snapshot.errMsg); err != nil {
			return fmt.Errorf("insert seed snapshot: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO property_runs (id, property_id, status, trigger_kind, attempt_count, max_attempts, started_at, finished_at, error_message, snapshot_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			d.id(fmt.Sprintf("run-%d", index+1)), snapshot.propertyID, map[bool]string{true: "success", false: "failed"}[snapshot.errMsg == ""], "seed", 1, 3, lastRun, formatTime(d.now.Add(time.Duration(index)*time.Minute)), snapshot.errMsg, snapshotID, created); err != nil {
			return fmt.Errorf("insert seed property run: %w", err)
		}
	}

	userID := d.id("usr-analyst")
	if _, err := tx.ExecContext(ctx, `INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		userID, d.email(), "Seed Analyst", "$2a$10$lUi2cU1fXGVlKecvXTnUweYQ3PAuHOX2dVcPoxZyIyqkFqa8WF/0G", created, created); err != nil {
		return fmt.Errorf("insert seed user: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO bookmarks (user_id, property_id, created_at) VALUES (?, ?, ?)`, userID, d.id("prop-bilbao-flat"), created); err != nil {
		return fmt.Errorf("insert seed bookmark: %w", err)
	}
	threshold := int64(250000)
	if _, err := tx.ExecContext(ctx, `INSERT INTO alert_rules (id, user_id, property_id, rule_type, threshold_amount, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		d.id("alert-bilbao-price"), userID, d.id("prop-bilbao-flat"), "price_below", threshold, 1, created, created); err != nil {
		return fmt.Errorf("insert seed alert rule: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO notifications (id, user_id, alert_id, property_id, kind, title, body, data_json, delivery_status, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		d.id("note-bilbao-price"), userID, d.id("alert-bilbao-price"), d.id("prop-bilbao-flat"), "price_below", "Seed price threshold reached", "Bilbao flat is below the seeded target price.", compactJSON(`{"price":"239000","threshold":"250000"}`), "delivered", created, nil); err != nil {
		return fmt.Errorf("insert seed notification: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `INSERT INTO ingestion_runs (id, source_id, correlation_id, trigger_kind, status, started_at, finished_at, attempt_count, item_count, diagnostics_json, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		d.id("ingestion-public-success"), d.id("src-public"), d.id("corr-public"), "seed", "success", lastRun, created, 1, 3, compactJSON(`{"seed":true}`), nil); err != nil {
		return fmt.Errorf("insert seed ingestion run: %w", err)
	}

	return nil
}

/**
 * Purpose:
 * Performs the id operation for this backend package.
 *
 * Parameters:
 * - d seedData
 *
 * Returns:
 * - id(suffix string) string
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
func (d seedData) id(suffix string) string {
	return d.prefix + "-" + suffix
}

/**
 * Purpose:
 * Performs the like operation for this backend package.
 *
 * Parameters:
 * - d seedData
 *
 * Returns:
 * - like() string
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
func (d seedData) like() string {
	return d.prefix + "-%"
}

/**
 * Purpose:
 * Performs the email operation for this backend package.
 *
 * Parameters:
 * - d seedData
 *
 * Returns:
 * - email() string
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
func (d seedData) email() string {
	return d.prefix + "-analyst@local"
}

/**
 * Purpose:
 * Performs the boolInt operation for this backend package.
 *
 * Parameters:
 * - value bool
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
func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

/**
 * Purpose:
 * Performs the formatTime operation for this backend package.
 *
 * Parameters:
 * - value time.Time
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
func formatTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339Nano)
}

/**
 * Purpose:
 * Performs the compactJSON operation for this backend package.
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
func compactJSON(raw string) string {
	var payload any
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return raw
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return raw
	}
	return string(encoded)
}
