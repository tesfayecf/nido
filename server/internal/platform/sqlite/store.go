package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	authdomain "nido/server/internal/auth/domain"
	engagementdomain "nido/server/internal/engagement/domain"
	ingestiondomain "nido/server/internal/ingestion/domain"
	"nido/server/internal/platform/id"
	platformopsdomain "nido/server/internal/platformops/domain"
)

// Store implements the repository contracts needed by the backend runtime.
type Store struct {
	db *sql.DB
}

// NewStore builds a SQLite-backed repository implementation.
func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// UpsertSource creates or updates a source definition.
func (s *Store) UpsertSource(ctx context.Context, source ingestiondomain.Source) error {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO sources (
			id, name, kind, endpoint_url, config_json, browser_enabled, active,
			rate_limit_window_seconds, rate_limit_max_requests, retry_max_attempts, retry_backoff_millis,
			schedule_interval_seconds, freshness_window_seconds, next_run_at, last_run_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			kind = excluded.kind,
			endpoint_url = excluded.endpoint_url,
			config_json = excluded.config_json,
			browser_enabled = excluded.browser_enabled,
			active = excluded.active,
			rate_limit_window_seconds = excluded.rate_limit_window_seconds,
			rate_limit_max_requests = excluded.rate_limit_max_requests,
			retry_max_attempts = excluded.retry_max_attempts,
			retry_backoff_millis = excluded.retry_backoff_millis,
			schedule_interval_seconds = excluded.schedule_interval_seconds,
			freshness_window_seconds = excluded.freshness_window_seconds,
			next_run_at = excluded.next_run_at,
			last_run_at = excluded.last_run_at,
			updated_at = excluded.updated_at`,
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
		return fmt.Errorf("upsert source: %w", err)
	}

	return nil
}

// ListSources returns all known sources.
func (s *Store) ListSources(ctx context.Context) ([]ingestiondomain.Source, error) {
	rows, err := s.db.QueryContext(ctx, sourceSelect+` ORDER BY name ASC, id ASC`)
	if err != nil {
		return nil, fmt.Errorf("list sources: %w", err)
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

// ListDueSources returns sources whose schedules are ready to run.
func (s *Store) ListDueSources(ctx context.Context, before time.Time, limit int) ([]ingestiondomain.Source, error) {
	rows, err := s.db.QueryContext(
		ctx,
		sourceSelect+` WHERE active = 1 AND schedule_interval_seconds > 0 AND (next_run_at IS NULL OR next_run_at <= ?) ORDER BY COALESCE(next_run_at, created_at) ASC LIMIT ?`,
		formatTime(before),
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("list due sources: %w", err)
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

// GetSource returns one source definition.
func (s *Store) GetSource(ctx context.Context, sourceID string) (ingestiondomain.Source, error) {
	return scanSource(s.db.QueryRowContext(ctx, sourceSelect+` WHERE id = ?`, sourceID))
}

// DeleteSource removes one source definition.
func (s *Store) DeleteSource(ctx context.Context, sourceID string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction for source deletion: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.ExecContext(ctx, `DELETE FROM artifacts WHERE source_id = ?`, sourceID); err != nil {
		return fmt.Errorf("delete source artifacts: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM ingestion_runs WHERE source_id = ?`, sourceID); err != nil {
		return fmt.Errorf("delete source runs: %w", err)
	}

	result, err := tx.ExecContext(ctx, `DELETE FROM sources WHERE id = ?`, sourceID)
	if err != nil {
		return fmt.Errorf("delete source: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read deleted source rows: %w", err)
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit source delete: %w", err)
	}

	return nil
}

// UpdateSourceRunState records the latest and next scheduler timestamps.
func (s *Store) UpdateSourceRunState(ctx context.Context, sourceID string, lastRunAt, nextRunAt *time.Time) error {
	_, err := s.db.ExecContext(
		ctx,
		`UPDATE sources SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE id = ?`,
		nullableTimeString(lastRunAt),
		nullableTimeString(nextRunAt),
		formatTime(time.Now().UTC()),
		sourceID,
	)
	if err != nil {
		return fmt.Errorf("update source run state: %w", err)
	}

	return nil
}

// CountRunsSince returns the number of runs that started after the supplied time.
func (s *Store) CountRunsSince(ctx context.Context, sourceID string, since time.Time) (int, error) {
	var count int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM ingestion_runs WHERE source_id = ? AND started_at >= ?`, sourceID, formatTime(since)).Scan(&count); err != nil {
		return 0, fmt.Errorf("count runs since: %w", err)
	}

	return count, nil
}

// TryAcquireIngestionLock acquires the per-source ingest lock when available.
func (s *Store) TryAcquireIngestionLock(ctx context.Context, sourceID, holderID string, acquiredAt, expiresAt time.Time) (bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, fmt.Errorf("begin lock transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var existingHolder string
	var existingExpires string
	err = tx.QueryRowContext(ctx, `SELECT holder_id, expires_at FROM ingestion_locks WHERE source_id = ?`, sourceID).Scan(&existingHolder, &existingExpires)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		_, err = tx.ExecContext(ctx, `INSERT INTO ingestion_locks (source_id, holder_id, acquired_at, expires_at) VALUES (?, ?, ?, ?)`, sourceID, holderID, formatTime(acquiredAt), formatTime(expiresAt))
		if err != nil {
			return false, fmt.Errorf("insert ingestion lock: %w", err)
		}
	case err != nil:
		return false, fmt.Errorf("query ingestion lock: %w", err)
	default:
		parsedExpiry, err := parseTime(existingExpires)
		if err != nil {
			return false, err
		}
		if existingHolder != holderID && parsedExpiry.After(acquiredAt) {
			return false, nil
		}

		_, err = tx.ExecContext(ctx, `UPDATE ingestion_locks SET holder_id = ?, acquired_at = ?, expires_at = ? WHERE source_id = ?`, holderID, formatTime(acquiredAt), formatTime(expiresAt), sourceID)
		if err != nil {
			return false, fmt.Errorf("update ingestion lock: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("commit ingestion lock: %w", err)
	}

	return true, nil
}

// ReleaseIngestionLock releases a previously acquired source lock.
func (s *Store) ReleaseIngestionLock(ctx context.Context, sourceID, holderID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM ingestion_locks WHERE source_id = ? AND holder_id = ?`, sourceID, holderID)
	if err != nil {
		return fmt.Errorf("release ingestion lock: %w", err)
	}

	return nil
}

// CreateRun records the start of a new ingestion run.
func (s *Store) CreateRun(ctx context.Context, run ingestiondomain.Run) error {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO ingestion_runs (
			id, source_id, correlation_id, trigger_kind, status, started_at, finished_at,
			attempt_count, item_count, artifact_key, failure_artifact_key, diagnostics_json, error_message
		) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 0, NULL, NULL, ?, NULL)`,
		run.ID,
		run.SourceID,
		run.CorrelationID,
		run.TriggerKind,
		string(run.Status),
		formatTime(run.StartedAt),
		run.AttemptCount,
		normalizeJSON(run.Diagnostics),
	)
	if err != nil {
		return fmt.Errorf("create run: %w", err)
	}

	return nil
}

// CompleteRun records a successful ingest completion.
func (s *Store) CompleteRun(ctx context.Context, runID string, finishedAt time.Time, itemCount int, artifactKey string, attemptCount int, diagnostics json.RawMessage) error {
	_, err := s.db.ExecContext(
		ctx,
		`UPDATE ingestion_runs
		 SET status = ?, finished_at = ?, attempt_count = ?, item_count = ?, artifact_key = ?, failure_artifact_key = NULL, diagnostics_json = ?, error_message = NULL
		 WHERE id = ?`,
		string(ingestiondomain.RunStatusCompleted),
		formatTime(finishedAt),
		attemptCount,
		itemCount,
		artifactKey,
		normalizeJSON(diagnostics),
		runID,
	)
	if err != nil {
		return fmt.Errorf("complete run: %w", err)
	}

	return nil
}

// FailRun records a failed ingest completion.
func (s *Store) FailRun(ctx context.Context, runID string, finishedAt time.Time, errorMessage string, failureArtifactKey string, attemptCount int, diagnostics json.RawMessage) error {
	_, err := s.db.ExecContext(
		ctx,
		`UPDATE ingestion_runs
		 SET status = ?, finished_at = ?, attempt_count = ?, failure_artifact_key = ?, diagnostics_json = ?, error_message = ?
		 WHERE id = ?`,
		string(ingestiondomain.RunStatusFailed),
		formatTime(finishedAt),
		attemptCount,
		nullableString(failureArtifactKey),
		normalizeJSON(diagnostics),
		errorMessage,
		runID,
	)
	if err != nil {
		return fmt.Errorf("fail run: %w", err)
	}

	return nil
}

// ListRuns returns recent runs ordered by start time.
func (s *Store) ListRuns(ctx context.Context, sourceID string, limit int) ([]ingestiondomain.Run, error) {
	query := runSelect
	args := make([]any, 0, 2)

	if strings.TrimSpace(sourceID) != "" {
		query += ` WHERE source_id = ?`
		args = append(args, sourceID)
	}

	query += ` ORDER BY started_at DESC, id DESC LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list runs: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.Run, 0)
	for rows.Next() {
		run, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, run)
	}

	return items, rows.Err()
}

// GetRun returns one run with diagnostics.
func (s *Store) GetRun(ctx context.Context, runID string) (ingestiondomain.Run, error) {
	return scanRun(s.db.QueryRowContext(ctx, runSelect+` WHERE id = ?`, runID))
}

// RecordArtifact stores the metadata for a raw source payload.
func (s *Store) RecordArtifact(ctx context.Context, artifact ingestiondomain.Artifact) error {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO artifacts (key, source_id, run_id, kind, content_type, checksum, byte_size, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET
		     source_id = excluded.source_id,
		     run_id = excluded.run_id,
		     kind = excluded.kind,
		     content_type = excluded.content_type,
		     checksum = excluded.checksum,
		     byte_size = excluded.byte_size,
		     created_at = excluded.created_at`,
		artifact.Key,
		artifact.SourceID,
		artifact.RunID,
		artifact.Kind,
		artifact.ContentType,
		artifact.Checksum,
		artifact.ByteSize,
		formatTime(artifact.CreatedAt),
	)
	if err != nil {
		return fmt.Errorf("record artifact: %w", err)
	}

	return nil
}

// ReplaceObservedListings upserts the listings observed during one ingest run.
func (s *Store) ReplaceObservedListings(ctx context.Context, sourceID string, observedAt time.Time, candidates []ingestiondomain.CandidateListing) ([]ingestiondomain.ListingChange, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin listing transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	changes := make([]ingestiondomain.ListingChange, 0)
	for _, candidate := range candidates {
		listingID := id.Deterministic("listing", sourceID+":"+candidate.ExternalID)

		var existingPrice int64
		err := tx.QueryRowContext(ctx, `SELECT price_amount FROM listings WHERE id = ?`, listingID).Scan(&existingPrice)
		switch {
		case errors.Is(err, sql.ErrNoRows):
			_, err = tx.ExecContext(
				ctx,
				`INSERT INTO listings (id, source_id, external_id, title, price_amount, currency, location, url, first_seen_at, last_seen_at, latest_snapshot_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				listingID,
				sourceID,
				candidate.ExternalID,
				candidate.Title,
				candidate.PriceAmount,
				candidate.Currency,
				candidate.Location,
				candidate.URL,
				formatTime(observedAt),
				formatTime(observedAt),
				formatTime(observedAt),
			)
			if err != nil {
				return nil, fmt.Errorf("insert listing: %w", err)
			}

			changes = append(changes, ingestiondomain.ListingChange{
				ListingID:   listingID,
				SourceID:    sourceID,
				Title:       candidate.Title,
				PriceAmount: candidate.PriceAmount,
				Currency:    candidate.Currency,
				Location:    candidate.Location,
				URL:         candidate.URL,
				IsNew:       true,
			})
		case err != nil:
			return nil, fmt.Errorf("query listing: %w", err)
		default:
			var previousAmount *int64
			priceChanged := existingPrice != candidate.PriceAmount
			if priceChanged {
				_, err = tx.ExecContext(
					ctx,
					`INSERT INTO price_events (id, listing_id, previous_amount, new_amount, changed_at)
					 VALUES (?, ?, ?, ?, ?)`,
					id.New("price"),
					listingID,
					existingPrice,
					candidate.PriceAmount,
					formatTime(observedAt),
				)
				if err != nil {
					return nil, fmt.Errorf("insert price event: %w", err)
				}

				value := existingPrice
				previousAmount = &value
			}

			_, err = tx.ExecContext(
				ctx,
				`UPDATE listings
				 SET title = ?, price_amount = ?, currency = ?, location = ?, url = ?, last_seen_at = ?, latest_snapshot_at = ?
				 WHERE id = ?`,
				candidate.Title,
				candidate.PriceAmount,
				candidate.Currency,
				candidate.Location,
				candidate.URL,
				formatTime(observedAt),
				formatTime(observedAt),
				listingID,
			)
			if err != nil {
				return nil, fmt.Errorf("update listing: %w", err)
			}

			if priceChanged {
				changes = append(changes, ingestiondomain.ListingChange{
					ListingID:      listingID,
					SourceID:       sourceID,
					Title:          candidate.Title,
					PriceAmount:    candidate.PriceAmount,
					Currency:       candidate.Currency,
					Location:       candidate.Location,
					URL:            candidate.URL,
					PriceChanged:   true,
					PreviousAmount: previousAmount,
				})
			}
		}

		_, err = tx.ExecContext(
			ctx,
			`INSERT INTO listing_snapshots (id, listing_id, observed_at, title, price_amount, currency, location, url)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id.New("snapshot"),
			listingID,
			formatTime(observedAt),
			candidate.Title,
			candidate.PriceAmount,
			candidate.Currency,
			candidate.Location,
			candidate.URL,
		)
		if err != nil {
			return nil, fmt.Errorf("insert listing snapshot: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit listing transaction: %w", err)
	}

	return changes, nil
}

// UpsertUser creates or updates a user account.
func (s *Store) UpsertUser(ctx context.Context, user authdomain.User, passwordHash string) error {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(email) DO UPDATE SET
			id = excluded.id,
			display_name = excluded.display_name,
			password_hash = excluded.password_hash,
			updated_at = excluded.updated_at`,
		user.ID,
		strings.ToLower(user.Email),
		user.DisplayName,
		passwordHash,
		formatTime(user.CreatedAt),
		formatTime(user.UpdatedAt),
	)
	if err != nil {
		return fmt.Errorf("upsert user: %w", err)
	}

	return nil
}

// UpdateUserProfile updates mutable profile fields for a user.
func (s *Store) UpdateUserProfile(ctx context.Context, userID, displayName string, updatedAt time.Time) error {
	result, err := s.db.ExecContext(
		ctx,
		`UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?`,
		displayName,
		formatTime(updatedAt),
		userID,
	)
	if err != nil {
		return fmt.Errorf("update user profile: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("update user profile rows: %w", err)
	}
	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// UpdateUserPassword stores a new password hash for a user.
func (s *Store) UpdateUserPassword(ctx context.Context, userID, passwordHash string, updatedAt time.Time) error {
	result, err := s.db.ExecContext(
		ctx,
		`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`,
		passwordHash,
		formatTime(updatedAt),
		userID,
	)
	if err != nil {
		return fmt.Errorf("update user password: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("update user password rows: %w", err)
	}
	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// GetUserByEmail loads one user and its password hash.
func (s *Store) GetUserByEmail(ctx context.Context, email string) (authdomain.User, string, error) {
	var passwordHash string
	row := s.db.QueryRowContext(ctx, `SELECT id, email, display_name, password_hash, created_at, updated_at FROM users WHERE email = ?`, strings.ToLower(email))
	user, err := scanUser(row, &passwordHash)
	if err != nil {
		return authdomain.User{}, "", err
	}

	return user, passwordHash, nil
}

// GetUserByID loads one user by identifier.
func (s *Store) GetUserByID(ctx context.Context, userID string) (authdomain.User, error) {
	return scanUser(s.db.QueryRowContext(ctx, `SELECT id, email, display_name, NULL, created_at, updated_at FROM users WHERE id = ?`, userID), nil)
}

// GetUserCredentials returns the password hash for a user by id.
func (s *Store) GetUserCredentials(ctx context.Context, userID string) (string, error) {
	var passwordHash string
	row := s.db.QueryRowContext(ctx, `SELECT password_hash FROM users WHERE id = ?`, userID)
	if err := row.Scan(&passwordHash); err != nil {
		return "", err
	}

	return passwordHash, nil
}

// CreateSession persists a login session.
func (s *Store) CreateSession(ctx context.Context, session authdomain.Session, tokenHash string) error {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO auth_sessions (id, user_id, token_hash, created_at, expires_at, revoked_at)
		 VALUES (?, ?, ?, ?, ?, NULL)`,
		session.ID,
		session.UserID,
		tokenHash,
		formatTime(session.CreatedAt),
		formatTime(session.ExpiresAt),
	)
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}

	return nil
}

// GetSessionByTokenHash looks up one active session and its user.
func (s *Store) GetSessionByTokenHash(ctx context.Context, tokenHash string) (authdomain.Session, authdomain.User, error) {
	row := s.db.QueryRowContext(
		ctx,
		`SELECT s.id, s.user_id, s.created_at, s.expires_at, s.revoked_at, u.id, u.email, u.display_name, u.created_at, u.updated_at
		 FROM auth_sessions s
		 JOIN users u ON u.id = s.user_id
		 WHERE s.token_hash = ?`,
		tokenHash,
	)

	var (
		session              authdomain.Session
		user                 authdomain.User
		createdAt, expiresAt string
		revokedAt            sql.NullString
		userCreatedAt        string
		userUpdatedAt        string
	)

	if err := row.Scan(
		&session.ID,
		&session.UserID,
		&createdAt,
		&expiresAt,
		&revokedAt,
		&user.ID,
		&user.Email,
		&user.DisplayName,
		&userCreatedAt,
		&userUpdatedAt,
	); err != nil {
		return authdomain.Session{}, authdomain.User{}, err
	}

	var err error
	session.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return authdomain.Session{}, authdomain.User{}, err
	}
	session.ExpiresAt, err = parseTime(expiresAt)
	if err != nil {
		return authdomain.Session{}, authdomain.User{}, err
	}
	if revokedAt.Valid {
		parsedRevokedAt, err := parseTime(revokedAt.String)
		if err != nil {
			return authdomain.Session{}, authdomain.User{}, err
		}
		session.RevokedAt = &parsedRevokedAt
	}
	user.CreatedAt, err = parseTime(userCreatedAt)
	if err != nil {
		return authdomain.Session{}, authdomain.User{}, err
	}
	user.UpdatedAt, err = parseTime(userUpdatedAt)
	if err != nil {
		return authdomain.Session{}, authdomain.User{}, err
	}

	return session, user, nil
}

// RevokeSession invalidates an existing session.
func (s *Store) RevokeSession(ctx context.Context, sessionID string, revokedAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `UPDATE auth_sessions SET revoked_at = ? WHERE id = ?`, formatTime(revokedAt), sessionID)
	if err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}

	return nil
}

// AddBookmark saves one property bookmark for the user.
func (s *Store) AddBookmark(ctx context.Context, userID, propertyID string, createdAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO bookmarks (user_id, property_id, created_at) VALUES (?, ?, ?) ON CONFLICT(user_id, property_id) DO NOTHING`, userID, propertyID, formatTime(createdAt))
	if err != nil {
		return fmt.Errorf("add bookmark: %w", err)
	}

	return nil
}

// ListBookmarks returns the user's saved properties.
func (s *Store) ListBookmarks(ctx context.Context, userID string) ([]engagementdomain.BookmarkedProperty, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT b.property_id, p.source_id, p.label, p.url, b.created_at,
		        COALESCE((
		            SELECT values_json
		            FROM property_snapshots
		            WHERE property_id = p.id
		            ORDER BY observed_at DESC, id DESC
		            LIMIT 1
		        ), '{}')
		 FROM bookmarks b
		 JOIN properties p ON p.id = b.property_id
		 WHERE b.user_id = ?
		 ORDER BY b.created_at DESC, b.property_id DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list bookmarks: %w", err)
	}
	defer rows.Close()

	items := make([]engagementdomain.BookmarkedProperty, 0)
	for rows.Next() {
		var (
			item       engagementdomain.BookmarkedProperty
			sourceID   sql.NullString
			label      string
			valuesJSON string
			createdAt  string
		)
		if err := rows.Scan(&item.PropertyID, &sourceID, &label, &item.URL, &createdAt, &valuesJSON); err != nil {
			return nil, fmt.Errorf("scan bookmark: %w", err)
		}
		if sourceID.Valid {
			item.SourceID = sourceID.String
		}
		values := decodeSnapshotValues(valuesJSON)
		item.Title = firstNonEmpty(values["title"], label, item.URL)
		item.Location = values["location"]
		item.Currency = values["currency"]
		item.PriceAmount = parseSnapshotPrice(values)
		item.BookmarkedAt, err = parseTime(createdAt)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

// RemoveBookmark deletes one bookmark.
func (s *Store) RemoveBookmark(ctx context.Context, userID, propertyID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM bookmarks WHERE user_id = ? AND property_id = ?`, userID, propertyID)
	if err != nil {
		return fmt.Errorf("remove bookmark: %w", err)
	}

	return nil
}

// CreateWatchlist stores a user watchlist.
func (s *Store) CreateWatchlist(ctx context.Context, watchlist engagementdomain.Watchlist) error {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO watchlists (id, user_id, name, query, source_id, max_price_amount, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		watchlist.ID,
		watchlist.UserID,
		watchlist.Name,
		watchlist.Query,
		nullableString(watchlist.SourceID),
		nullableInt64(watchlist.MaxPriceAmount),
		formatTime(watchlist.CreatedAt),
		formatTime(watchlist.UpdatedAt),
	)
	if err != nil {
		return fmt.Errorf("create watchlist: %w", err)
	}

	return nil
}

// ListWatchlists returns watchlists for one user.
func (s *Store) ListWatchlists(ctx context.Context, userID string) ([]engagementdomain.Watchlist, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, user_id, name, query, source_id, max_price_amount, created_at, updated_at FROM watchlists WHERE user_id = ? ORDER BY created_at DESC, id DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("list watchlists: %w", err)
	}
	defer rows.Close()

	items := make([]engagementdomain.Watchlist, 0)
	for rows.Next() {
		watchlist, err := scanWatchlist(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, watchlist)
	}

	return items, rows.Err()
}

// ListWatchlistsForEvaluation returns all watchlists used by alert evaluation.
func (s *Store) ListWatchlistsForEvaluation(ctx context.Context) ([]engagementdomain.Watchlist, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, user_id, name, query, source_id, max_price_amount, created_at, updated_at FROM watchlists ORDER BY created_at DESC, id DESC`)
	if err != nil {
		return nil, fmt.Errorf("list watchlists for evaluation: %w", err)
	}
	defer rows.Close()

	items := make([]engagementdomain.Watchlist, 0)
	for rows.Next() {
		watchlist, err := scanWatchlist(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, watchlist)
	}

	return items, rows.Err()
}

// DeleteWatchlist removes a user watchlist.
func (s *Store) DeleteWatchlist(ctx context.Context, userID, watchlistID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM watchlists WHERE id = ? AND user_id = ?`, watchlistID, userID)
	if err != nil {
		return fmt.Errorf("delete watchlist: %w", err)
	}

	return nil
}

// CreateAlertRule stores an alert rule.
func (s *Store) CreateAlertRule(ctx context.Context, rule engagementdomain.AlertRule) error {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO alert_rules (id, user_id, property_id, rule_type, threshold_amount, enabled, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		rule.ID,
		rule.UserID,
		rule.PropertyID,
		rule.RuleType,
		nullableInt64(rule.ThresholdAmount),
		boolToInt(rule.Enabled),
		formatTime(rule.CreatedAt),
		formatTime(rule.UpdatedAt),
	)
	if err != nil {
		return fmt.Errorf("create alert rule: %w", err)
	}

	return nil
}

// ListAlertRules returns rules for one user.
func (s *Store) ListAlertRules(ctx context.Context, userID string) ([]engagementdomain.AlertRule, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, user_id, property_id, rule_type, threshold_amount, enabled, created_at, updated_at FROM alert_rules WHERE user_id = ? ORDER BY created_at DESC, id DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("list alert rules: %w", err)
	}
	defer rows.Close()

	items := make([]engagementdomain.AlertRule, 0)
	for rows.Next() {
		rule, err := scanAlertRule(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, rule)
	}

	return items, rows.Err()
}

// ListAlertRulesForEvaluation returns all enabled alert rules.
func (s *Store) ListAlertRulesForEvaluation(ctx context.Context) ([]engagementdomain.AlertRule, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, user_id, property_id, rule_type, threshold_amount, enabled, created_at, updated_at FROM alert_rules WHERE enabled = 1 ORDER BY created_at DESC, id DESC`)
	if err != nil {
		return nil, fmt.Errorf("list alert rules for evaluation: %w", err)
	}
	defer rows.Close()

	items := make([]engagementdomain.AlertRule, 0)
	for rows.Next() {
		rule, err := scanAlertRule(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, rule)
	}

	return items, rows.Err()
}

// UpdateAlertRuleEnabled updates one alert rule enabled state.
func (s *Store) UpdateAlertRuleEnabled(ctx context.Context, userID, ruleID string, enabled bool, updatedAt time.Time) error {
	_, err := s.db.ExecContext(
		ctx,
		`UPDATE alert_rules SET enabled = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
		boolToInt(enabled),
		formatTime(updatedAt),
		ruleID,
		userID,
	)
	if err != nil {
		return fmt.Errorf("update alert rule enabled: %w", err)
	}

	return nil
}

// DeleteAlertRule removes one alert rule.
func (s *Store) DeleteAlertRule(ctx context.Context, userID, ruleID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM alert_rules WHERE id = ? AND user_id = ?`, ruleID, userID)
	if err != nil {
		return fmt.Errorf("delete alert rule: %w", err)
	}

	return nil
}

// CreateNotification persists a generated notification.
func (s *Store) CreateNotification(ctx context.Context, notification engagementdomain.Notification) error {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO notifications (id, user_id, alert_id, property_id, kind, title, body, data_json, delivery_status, created_at, read_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		notification.ID,
		notification.UserID,
		nullableString(notification.AlertID),
		nullableString(notification.PropertyID),
		notification.Kind,
		notification.Title,
		notification.Body,
		normalizeJSON(notification.Data),
		notification.DeliveryStatus,
		formatTime(notification.CreatedAt),
		nullableTimeString(notification.ReadAt),
	)
	if err != nil {
		return fmt.Errorf("create notification: %w", err)
	}

	return nil
}

// UpdateNotificationDeliveryStatus changes the delivery status for a notification.
func (s *Store) UpdateNotificationDeliveryStatus(ctx context.Context, notificationID, status string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE notifications SET delivery_status = ? WHERE id = ?`, status, notificationID)
	if err != nil {
		return fmt.Errorf("update notification delivery status: %w", err)
	}

	return nil
}

// ListNotifications returns notifications for one user.
func (s *Store) ListNotifications(ctx context.Context, userID string, unreadOnly bool, limit int) ([]engagementdomain.Notification, error) {
	query := `SELECT id, user_id, alert_id, property_id, kind, title, body, data_json, delivery_status, created_at, read_at FROM notifications WHERE user_id = ?`
	args := []any{userID}
	if unreadOnly {
		query += ` AND read_at IS NULL`
	}
	query += ` ORDER BY created_at DESC, id DESC LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()

	items := make([]engagementdomain.Notification, 0)
	for rows.Next() {
		notification, err := scanNotification(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, notification)
	}

	return items, rows.Err()
}

// SetNotificationReadState updates the read timestamp for a notification.
func (s *Store) SetNotificationReadState(ctx context.Context, userID, notificationID string, readAt *time.Time) error {
	_, err := s.db.ExecContext(ctx, `UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?`, nullableTimeString(readAt), notificationID, userID)
	if err != nil {
		return fmt.Errorf("set notification read state: %w", err)
	}

	return nil
}

type scanner interface {
	Scan(dest ...any) error
}

var sourceSelect = `SELECT
	id, name, kind, endpoint_url, config_json, browser_enabled, active,
	rate_limit_window_seconds, rate_limit_max_requests, retry_max_attempts, retry_backoff_millis,
	schedule_interval_seconds, freshness_window_seconds, next_run_at, last_run_at, created_at, updated_at
FROM sources`

var runSelect = `SELECT
	id, source_id, correlation_id, trigger_kind, status, started_at, finished_at,
	attempt_count, item_count, artifact_key, failure_artifact_key, diagnostics_json, error_message
FROM ingestion_runs`

func scanSource(scanner scanner) (ingestiondomain.Source, error) {
	var (
		source               ingestiondomain.Source
		browserEnabled       int
		active               int
		nextRunAt, lastRunAt sql.NullString
		createdAt, updatedAt string
	)

	err := scanner.Scan(
		&source.ID,
		&source.Name,
		&source.Kind,
		&source.EndpointURL,
		&source.ConfigJSON,
		&browserEnabled,
		&active,
		&source.RateLimitWindowSeconds,
		&source.RateLimitMaxRequests,
		&source.RetryMaxAttempts,
		&source.RetryBackoffMillis,
		&source.ScheduleIntervalSeconds,
		&source.FreshnessWindowSeconds,
		&nextRunAt,
		&lastRunAt,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return ingestiondomain.Source{}, err
	}

	source.BrowserEnabled = browserEnabled == 1
	source.Active = active == 1
	source.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return ingestiondomain.Source{}, err
	}
	source.UpdatedAt, err = parseTime(updatedAt)
	if err != nil {
		return ingestiondomain.Source{}, err
	}
	if nextRunAt.Valid {
		parsedNextRunAt, err := parseTime(nextRunAt.String)
		if err != nil {
			return ingestiondomain.Source{}, err
		}
		source.NextRunAt = &parsedNextRunAt
	}
	if lastRunAt.Valid {
		parsedLastRunAt, err := parseTime(lastRunAt.String)
		if err != nil {
			return ingestiondomain.Source{}, err
		}
		source.LastRunAt = &parsedLastRunAt
	}

	return source, nil
}

func scanRun(scanner scanner) (ingestiondomain.Run, error) {
	var (
		run                ingestiondomain.Run
		status             string
		startedAt          string
		finishedAt         sql.NullString
		artifactKey        sql.NullString
		failureArtifactKey sql.NullString
		diagnosticsJSON    string
		errorMessage       sql.NullString
	)

	err := scanner.Scan(
		&run.ID,
		&run.SourceID,
		&run.CorrelationID,
		&run.TriggerKind,
		&status,
		&startedAt,
		&finishedAt,
		&run.AttemptCount,
		&run.ItemCount,
		&artifactKey,
		&failureArtifactKey,
		&diagnosticsJSON,
		&errorMessage,
	)
	if err != nil {
		return ingestiondomain.Run{}, err
	}

	run.Status = ingestiondomain.RunStatus(status)
	run.StartedAt, err = parseTime(startedAt)
	if err != nil {
		return ingestiondomain.Run{}, err
	}
	if finishedAt.Valid {
		parsedFinishedAt, err := parseTime(finishedAt.String)
		if err != nil {
			return ingestiondomain.Run{}, err
		}
		run.FinishedAt = &parsedFinishedAt
	}
	if artifactKey.Valid {
		run.ArtifactKey = artifactKey.String
	}
	if failureArtifactKey.Valid {
		run.FailureArtifactKey = failureArtifactKey.String
	}
	run.Diagnostics = json.RawMessage(normalizeJSONString(diagnosticsJSON))
	if errorMessage.Valid {
		run.ErrorMessage = errorMessage.String
	}

	return run, nil
}

func scanUser(scanner scanner, passwordHash *string) (authdomain.User, error) {
	var (
		user                 authdomain.User
		storedPasswordHash   sql.NullString
		createdAt, updatedAt string
	)

	err := scanner.Scan(&user.ID, &user.Email, &user.DisplayName, &storedPasswordHash, &createdAt, &updatedAt)
	if err != nil {
		return authdomain.User{}, err
	}

	user.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return authdomain.User{}, err
	}
	user.UpdatedAt, err = parseTime(updatedAt)
	if err != nil {
		return authdomain.User{}, err
	}
	if passwordHash != nil && storedPasswordHash.Valid {
		*passwordHash = storedPasswordHash.String
	}

	return user, nil
}

func scanWatchlist(scanner scanner) (engagementdomain.Watchlist, error) {
	var (
		watchlist            engagementdomain.Watchlist
		sourceID             sql.NullString
		maxPriceAmount       sql.NullInt64
		createdAt, updatedAt string
	)

	err := scanner.Scan(&watchlist.ID, &watchlist.UserID, &watchlist.Name, &watchlist.Query, &sourceID, &maxPriceAmount, &createdAt, &updatedAt)
	if err != nil {
		return engagementdomain.Watchlist{}, err
	}
	if sourceID.Valid {
		watchlist.SourceID = sourceID.String
	}
	if maxPriceAmount.Valid {
		value := maxPriceAmount.Int64
		watchlist.MaxPriceAmount = &value
	}
	watchlist.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return engagementdomain.Watchlist{}, err
	}
	watchlist.UpdatedAt, err = parseTime(updatedAt)
	if err != nil {
		return engagementdomain.Watchlist{}, err
	}

	return watchlist, nil
}

func scanAlertRule(scanner scanner) (engagementdomain.AlertRule, error) {
	var (
		rule                 engagementdomain.AlertRule
		thresholdAmount      sql.NullInt64
		enabled              int
		createdAt, updatedAt string
	)

	err := scanner.Scan(&rule.ID, &rule.UserID, &rule.PropertyID, &rule.RuleType, &thresholdAmount, &enabled, &createdAt, &updatedAt)
	if err != nil {
		return engagementdomain.AlertRule{}, err
	}
	if thresholdAmount.Valid {
		value := thresholdAmount.Int64
		rule.ThresholdAmount = &value
	}
	rule.Enabled = enabled == 1
	rule.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return engagementdomain.AlertRule{}, err
	}
	rule.UpdatedAt, err = parseTime(updatedAt)
	if err != nil {
		return engagementdomain.AlertRule{}, err
	}

	return rule, nil
}

func scanPropertyConfig(scanner scanner) (ingestiondomain.PropertyExtractionConfig, error) {
	var (
		config     ingestiondomain.PropertyExtractionConfig
		fieldsJSON string
		createdAt  string
	)

	if err := scanner.Scan(&config.ID, &config.PropertyID, &fieldsJSON, &config.Version, &createdAt, &config.ChangeSummary); err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, err
	}
	if err := json.Unmarshal([]byte(fieldsJSON), &config.Fields); err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, fmt.Errorf("unmarshal property fields: %w", err)
	}
	if config.Fields == nil {
		config.Fields = []ingestiondomain.FieldSelector{}
	}
	parsedCreatedAt, err := parseTime(createdAt)
	if err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, err
	}
	config.CreatedAt = parsedCreatedAt
	return config, nil
}

func scanNotification(scanner scanner) (engagementdomain.Notification, error) {
	var (
		notification engagementdomain.Notification
		alertID      sql.NullString
		propertyID   sql.NullString
		dataJSON     string
		createdAt    string
		readAt       sql.NullString
	)

	err := scanner.Scan(
		&notification.ID,
		&notification.UserID,
		&alertID,
		&propertyID,
		&notification.Kind,
		&notification.Title,
		&notification.Body,
		&dataJSON,
		&notification.DeliveryStatus,
		&createdAt,
		&readAt,
	)
	if err != nil {
		return engagementdomain.Notification{}, err
	}
	if alertID.Valid {
		notification.AlertID = alertID.String
	}
	if propertyID.Valid {
		notification.PropertyID = propertyID.String
	}
	notification.Data = json.RawMessage(normalizeJSONString(dataJSON))
	notification.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return engagementdomain.Notification{}, err
	}
	if readAt.Valid {
		parsedReadAt, err := parseTime(readAt.String)
		if err != nil {
			return engagementdomain.Notification{}, err
		}
		notification.ReadAt = &parsedReadAt
	}

	return notification, nil
}

func formatTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339Nano)
}

func parseTime(raw string) (time.Time, error) {
	parsed, err := time.Parse(time.RFC3339Nano, raw)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse time %q: %w", raw, err)
	}

	return parsed, nil
}

func nullableTimeString(value *time.Time) any {
	if value == nil {
		return nil
	}

	return formatTime(value.UTC())
}

func nullableString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}

	return value
}

func nullableInt64(value *int64) any {
	if value == nil {
		return nil
	}

	return *value
}

func normalizeJSON(value json.RawMessage) string {
	if len(value) == 0 {
		return "{}"
	}

	return normalizeJSONString(string(value))
}

func decodeSnapshotValues(raw string) map[string]string {
	values := make(map[string]string)
	if strings.TrimSpace(raw) == "" {
		return values
	}
	if err := json.Unmarshal([]byte(raw), &values); err != nil {
		return map[string]string{}
	}
	return values
}

func parseSnapshotPrice(values map[string]string) int64 {
	raw := normalizeNumberString(values["price"])
	if raw == "" {
		return 0
	}
	amount, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0
	}
	return amount
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func normalizeNumberString(value string) string {
	var digits strings.Builder
	for _, char := range value {
		if char >= '0' && char <= '9' {
			digits.WriteRune(char)
		}
	}
	return digits.String()
}

func normalizeJSONString(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "{}"
	}
	if !json.Valid([]byte(trimmed)) {
		encoded, _ := json.Marshal(map[string]string{"value": trimmed})
		return string(encoded)
	}

	return trimmed
}

func boolToInt(value bool) int {
	if value {
		return 1
	}

	return 0
}

func propertyMetadataIsZero(metadata ingestiondomain.PropertyMetadata) bool {
	return strings.TrimSpace(metadata.PriorityLevel) == "" &&
		strings.TrimSpace(metadata.BusinessStage) == "" &&
		metadata.TargetPrice == 0 &&
		metadata.ExpectedRent == 0 &&
		metadata.ExpectedYieldBps == 0 &&
		strings.TrimSpace(metadata.AcquisitionNotes) == "" &&
		strings.TrimSpace(metadata.DealThesis) == "" &&
		len(metadata.ExternalReferences) == 0 &&
		len(metadata.Attachments) == 0
}

func mustMarshalJSON(value any, fallback string) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return fallback
	}
	return string(encoded)
}

func decodeStringArrayJSON(raw string) []string {
	normalized := strings.TrimSpace(raw)
	if normalized == "" {
		return nil
	}
	var items []string
	if err := json.Unmarshal([]byte(normalizeJSONString(normalized)), &items); err != nil {
		return nil
	}
	filtered := make([]string, 0, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			filtered = append(filtered, trimmed)
		}
	}
	if len(filtered) == 0 {
		return nil
	}
	return filtered
}

func nullableInt(value int) any {
	if value <= 0 {
		return nil
	}
	return value
}

// ── Property persistence ──────────────────────────────────────────────────────

var propertySelect = `SELECT id, url, label, source_id, browser_enabled, request_headers_json, status, schedule_interval_seconds, retry_max_attempts, retry_backoff_millis, paused, pause_reason, metadata_json, last_run_at, next_run_at, created_at, updated_at FROM properties`

// UpsertProperty creates or updates a property record.
func (s *Store) UpsertProperty(ctx context.Context, property ingestiondomain.Property) error {
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

	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO properties (id, url, label, source_id, browser_enabled, request_headers_json, status, schedule_interval_seconds, retry_max_attempts, retry_backoff_millis, paused, pause_reason, metadata_json, last_run_at, next_run_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		 	url = excluded.url,
		 	label = excluded.label,
		 	source_id = excluded.source_id,
		 	browser_enabled = excluded.browser_enabled,
		 	request_headers_json = excluded.request_headers_json,
		 	status = excluded.status,
		 	schedule_interval_seconds = excluded.schedule_interval_seconds,
		 	retry_max_attempts = excluded.retry_max_attempts,
		 	retry_backoff_millis = excluded.retry_backoff_millis,
		 	paused = excluded.paused,
		 	pause_reason = excluded.pause_reason,
		 	metadata_json = excluded.metadata_json,
		 	last_run_at = excluded.last_run_at,
		 	next_run_at = excluded.next_run_at,
		 	updated_at = excluded.updated_at`,
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
		return fmt.Errorf("upsert property: %w", err)
	}

	return nil
}

// ListProperties returns all known properties ordered by creation time.
func (s *Store) ListProperties(ctx context.Context) ([]ingestiondomain.Property, error) {
	rows, err := s.db.QueryContext(ctx, propertySelect+` ORDER BY created_at DESC, id DESC`)
	if err != nil {
		return nil, fmt.Errorf("list properties: %w", err)
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

// ListDueProperties returns properties whose schedules are ready to run.
func (s *Store) ListDueProperties(ctx context.Context, before time.Time, limit int) ([]ingestiondomain.Property, error) {
	rows, err := s.db.QueryContext(
		ctx,
		propertySelect+` WHERE status != 'inactive' AND paused = 0 AND schedule_interval_seconds > 0 AND (next_run_at IS NULL OR next_run_at <= ?) ORDER BY COALESCE(next_run_at, created_at) ASC LIMIT ?`,
		formatTime(before),
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("list due properties: %w", err)
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

// GetProperty returns one property by identifier.
func (s *Store) GetProperty(ctx context.Context, propertyID string) (ingestiondomain.Property, error) {
	return scanProperty(s.db.QueryRowContext(ctx, propertySelect+` WHERE id = ?`, propertyID))
}

// DeleteProperty removes one property and dependent records.
func (s *Store) DeleteProperty(ctx context.Context, propertyID string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM properties WHERE id = ?`, propertyID)
	if err != nil {
		return fmt.Errorf("delete property: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read deleted property rows: %w", err)
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// UpdatePropertyRunState records the latest ingest timestamps and health status.
func (s *Store) UpdatePropertyRunState(ctx context.Context, propertyID string, status ingestiondomain.PropertyStatus, lastRunAt, nextRunAt *time.Time) error {
	_, err := s.db.ExecContext(
		ctx,
		`UPDATE properties SET status = ?, last_run_at = ?, next_run_at = ?, updated_at = ? WHERE id = ?`,
		string(status),
		nullableTimeString(lastRunAt),
		nullableTimeString(nextRunAt),
		formatTime(time.Now().UTC()),
		propertyID,
	)
	if err != nil {
		return fmt.Errorf("update property run state: %w", err)
	}

	return nil
}

// UpsertPropertyConfig saves a new extraction config version for a property.
func (s *Store) UpsertPropertyConfig(ctx context.Context, config ingestiondomain.PropertyExtractionConfig) error {
	fieldsJSON, err := json.Marshal(config.Fields)
	if err != nil {
		return fmt.Errorf("marshal property fields: %w", err)
	}

	_, err = s.db.ExecContext(
		ctx,
		`INSERT INTO property_extraction_configs (id, property_id, fields_json, version, created_at, change_summary)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET fields_json = excluded.fields_json, version = excluded.version, change_summary = excluded.change_summary`,
		config.ID,
		config.PropertyID,
		string(fieldsJSON),
		config.Version,
		formatTime(config.CreatedAt),
		config.ChangeSummary,
	)
	if err != nil {
		return fmt.Errorf("upsert property config: %w", err)
	}

	return nil
}

// GetLatestPropertyConfig returns the most recent config for a property.
// Returns an empty config (not an error) when no config exists yet.
func (s *Store) GetLatestPropertyConfig(ctx context.Context, propertyID string) (ingestiondomain.PropertyExtractionConfig, error) {
	row := s.db.QueryRowContext(
		ctx,
		`SELECT id, property_id, fields_json, version, created_at, change_summary FROM property_extraction_configs WHERE property_id = ? ORDER BY version DESC, id DESC LIMIT 1`,
		propertyID,
	)
	config, err := scanPropertyConfig(row)
	if errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.PropertyExtractionConfig{
			PropertyID: propertyID,
			Fields:     []ingestiondomain.FieldSelector{},
		}, nil
	}
	if err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, fmt.Errorf("get latest property config: %w", err)
	}

	return config, nil
}

// ListPropertyConfigs returns all config versions for a property.
func (s *Store) ListPropertyConfigs(ctx context.Context, propertyID string) ([]ingestiondomain.PropertyExtractionConfig, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, property_id, fields_json, version, created_at, change_summary
		 FROM property_extraction_configs
		 WHERE property_id = ?
		 ORDER BY version DESC, id DESC`,
		propertyID,
	)
	if err != nil {
		return nil, fmt.Errorf("list property configs: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.PropertyExtractionConfig, 0)
	for rows.Next() {
		config, err := scanPropertyConfig(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, config)
	}

	return items, rows.Err()
}

// GetPropertyConfigVersion returns one config version for a property.
func (s *Store) GetPropertyConfigVersion(ctx context.Context, propertyID string, version int) (ingestiondomain.PropertyExtractionConfig, error) {
	row := s.db.QueryRowContext(
		ctx,
		`SELECT id, property_id, fields_json, version, created_at, change_summary
		 FROM property_extraction_configs
		 WHERE property_id = ? AND version = ?
		 LIMIT 1`,
		propertyID,
		version,
	)
	return scanPropertyConfig(row)
}

// CreatePropertySnapshot records one extraction snapshot for a property.
func (s *Store) CreatePropertySnapshot(ctx context.Context, snapshot ingestiondomain.PropertySnapshot) error {
	valuesJSON := string(snapshot.Values)
	if valuesJSON == "" {
		valuesJSON = "{}"
	}
	changeFlagsJSON := string(snapshot.ChangeFlags)
	if changeFlagsJSON == "" {
		changeFlagsJSON = "{}"
	}

	var errorMessage any
	if snapshot.ErrorMessage != "" {
		errorMessage = snapshot.ErrorMessage
	}

	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO property_snapshots (id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		snapshot.ID,
		snapshot.PropertyID,
		snapshot.ConfigVersion,
		formatTime(snapshot.ObservedAt),
		valuesJSON,
		changeFlagsJSON,
		boolToInt(snapshot.IsValid),
		errorMessage,
	)
	if err != nil {
		return fmt.Errorf("create property snapshot: %w", err)
	}

	return nil
}

// ListPropertySnapshots returns the most recent snapshots for a property.
func (s *Store) ListPropertySnapshots(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error) {
	if limit <= 0 {
		limit = 20
	}

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message FROM property_snapshots WHERE property_id = ? ORDER BY observed_at DESC, id DESC LIMIT ?`,
		propertyID,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("list property snapshots: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.PropertySnapshot, 0)
	for rows.Next() {
		snapshot, err := scanPropertySnapshot(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, snapshot)
	}

	return items, rows.Err()
}

// ListAllPropertySnapshots returns recent snapshots across all properties.
func (s *Store) ListAllPropertySnapshots(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertySnapshot, error) {
	if limit <= 0 {
		limit = 20
	}

	query := `SELECT id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message FROM property_snapshots`
	args := []any{}
	if strings.TrimSpace(propertyID) != "" {
		query += ` WHERE property_id = ?`
		args = append(args, propertyID)
	}
	query += ` ORDER BY observed_at DESC, id DESC LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list all property snapshots: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.PropertySnapshot, 0)
	for rows.Next() {
		snapshot, err := scanPropertySnapshot(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, snapshot)
	}

	return items, rows.Err()
}

// GetPropertySnapshot returns one snapshot by identifier.
func (s *Store) GetPropertySnapshot(ctx context.Context, snapshotID string) (ingestiondomain.PropertySnapshot, error) {
	return scanPropertySnapshot(s.db.QueryRowContext(
		ctx,
		`SELECT id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message FROM property_snapshots WHERE id = ?`,
		snapshotID,
	))
}

// DeletePropertySnapshot removes one property snapshot.
func (s *Store) DeletePropertySnapshot(ctx context.Context, snapshotID string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM property_snapshots WHERE id = ?`, snapshotID)
	if err != nil {
		return fmt.Errorf("delete property snapshot: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read deleted property snapshot rows: %w", err)
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// GetLastValidPropertySnapshot returns the most recent valid snapshot for a property.
func (s *Store) GetLastValidPropertySnapshot(ctx context.Context, propertyID string) (ingestiondomain.PropertySnapshot, error) {
	snapshot, err := scanPropertySnapshot(s.db.QueryRowContext(
		ctx,
		`SELECT id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message FROM property_snapshots WHERE property_id = ? AND is_valid = 1 ORDER BY observed_at DESC, id DESC LIMIT 1`,
		propertyID,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.PropertySnapshot{PropertyID: propertyID}, nil
	}

	return snapshot, err
}

// GetLatestPropertySnapshots returns up to n most-recent snapshots for a property (any validity).
func (s *Store) GetLatestPropertySnapshots(ctx context.Context, propertyID string, n int) ([]ingestiondomain.PropertySnapshot, error) {
	if n <= 0 {
		n = 2
	}
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message FROM property_snapshots WHERE property_id = ? ORDER BY observed_at DESC, id DESC LIMIT ?`,
		propertyID,
		n,
	)
	if err != nil {
		return nil, fmt.Errorf("get latest property snapshots: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.PropertySnapshot, 0, n)
	for rows.Next() {
		snapshot, err := scanPropertySnapshot(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, snapshot)
	}
	return items, rows.Err()
}

func scanProperty(s scanner) (ingestiondomain.Property, error) {
	var (
		property             ingestiondomain.Property
		sourceID             sql.NullString
		browserEnabled       int
		requestHeadersJSON   string
		status               string
		paused               int
		pauseReason          string
		metadataJSON         string
		lastRunAt, nextRunAt sql.NullString
		createdAt, updatedAt string
	)

	err := s.Scan(
		&property.ID,
		&property.URL,
		&property.Label,
		&sourceID,
		&browserEnabled,
		&requestHeadersJSON,
		&status,
		&property.ScheduleIntervalSeconds,
		&property.RetryMaxAttempts,
		&property.RetryBackoffMillis,
		&paused,
		&pauseReason,
		&metadataJSON,
		&lastRunAt,
		&nextRunAt,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return ingestiondomain.Property{}, err
	}
	if sourceID.Valid {
		property.SourceID = sourceID.String
	}
	property.BrowserEnabled = browserEnabled == 1
	if strings.TrimSpace(requestHeadersJSON) != "" {
		if err := json.Unmarshal([]byte(requestHeadersJSON), &property.RequestHeaders); err != nil {
			return ingestiondomain.Property{}, fmt.Errorf("unmarshal property request headers: %w", err)
		}
		if len(property.RequestHeaders) == 0 {
			property.RequestHeaders = nil
		}
	}

	property.Status = ingestiondomain.PropertyStatus(status)
	property.Paused = paused == 1
	property.PauseReason = pauseReason
	if strings.TrimSpace(metadataJSON) != "" {
		if err := json.Unmarshal([]byte(normalizeJSONString(metadataJSON)), &property.Metadata); err != nil {
			return ingestiondomain.Property{}, fmt.Errorf("unmarshal property metadata: %w", err)
		}
	}
	property.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return ingestiondomain.Property{}, err
	}
	property.UpdatedAt, err = parseTime(updatedAt)
	if err != nil {
		return ingestiondomain.Property{}, err
	}
	if lastRunAt.Valid {
		parsedLastRunAt, err := parseTime(lastRunAt.String)
		if err != nil {
			return ingestiondomain.Property{}, err
		}
		property.LastRunAt = &parsedLastRunAt
	}
	if nextRunAt.Valid {
		parsedNextRunAt, err := parseTime(nextRunAt.String)
		if err != nil {
			return ingestiondomain.Property{}, err
		}
		property.NextRunAt = &parsedNextRunAt
	}

	return property, nil
}

func scanPropertySnapshot(s scanner) (ingestiondomain.PropertySnapshot, error) {
	var (
		snapshot                    ingestiondomain.PropertySnapshot
		observedAt                  string
		valuesJSON, changeFlagsJSON string
		isValid                     int
		errorMessage                sql.NullString
	)

	err := s.Scan(
		&snapshot.ID,
		&snapshot.PropertyID,
		&snapshot.ConfigVersion,
		&observedAt,
		&valuesJSON,
		&changeFlagsJSON,
		&isValid,
		&errorMessage,
	)
	if err != nil {
		return ingestiondomain.PropertySnapshot{}, err
	}

	snapshot.IsValid = isValid == 1
	snapshot.Values = json.RawMessage(normalizeJSONString(valuesJSON))
	snapshot.ChangeFlags = json.RawMessage(normalizeJSONString(changeFlagsJSON))
	if errorMessage.Valid {
		snapshot.ErrorMessage = errorMessage.String
	}
	snapshot.ObservedAt, err = parseTime(observedAt)
	if err != nil {
		return ingestiondomain.PropertySnapshot{}, err
	}

	return snapshot, nil
}

// CreateTag inserts a new tag.
func (s *Store) CreateTag(ctx context.Context, tag ingestiondomain.Tag) error {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO tags (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		tag.ID,
		tag.Name,
		tag.Color,
		formatTime(tag.CreatedAt),
		formatTime(tag.UpdatedAt),
	)
	if err != nil {
		return fmt.Errorf("create tag: %w", err)
	}
	return nil
}

// GetTagByName returns a tag by its name (case-insensitive).
func (s *Store) GetTagByName(ctx context.Context, name string) (ingestiondomain.Tag, error) {
	tag, err := scanTag(s.db.QueryRowContext(
		ctx,
		`SELECT id, name, color, created_at, updated_at FROM tags WHERE name = ? COLLATE NOCASE`,
		name,
	))
	if err != nil {
		return ingestiondomain.Tag{}, err
	}
	return tag, nil
}

// GetTag returns a tag by its ID.
func (s *Store) GetTag(ctx context.Context, tagID string) (ingestiondomain.Tag, error) {
	tag, err := scanTag(s.db.QueryRowContext(
		ctx,
		`SELECT id, name, color, created_at, updated_at FROM tags WHERE id = ?`,
		tagID,
	))
	if err != nil {
		return ingestiondomain.Tag{}, err
	}
	return tag, nil
}

// ListTags returns all tags ordered by name.
func (s *Store) ListTags(ctx context.Context) ([]ingestiondomain.Tag, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, name, color, created_at, updated_at FROM tags ORDER BY name ASC, id ASC`)
	if err != nil {
		return nil, fmt.Errorf("list tags: %w", err)
	}
	defer rows.Close()

	tags := make([]ingestiondomain.Tag, 0)
	for rows.Next() {
		tag, err := scanTag(rows)
		if err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}

	return tags, rows.Err()
}

// DeleteTag removes a tag and its property associations.
func (s *Store) DeleteTag(ctx context.Context, tagID string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM tags WHERE id = ?`, tagID)
	if err != nil {
		return fmt.Errorf("delete tag: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read deleted tag rows: %w", err)
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// AssignTags replaces the full set of tags for a property (idempotent).
func (s *Store) AssignTags(ctx context.Context, propertyID string, tagIDs []string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Remove existing tags
	_, err = tx.ExecContext(ctx, `DELETE FROM property_tags WHERE property_id = ?`, propertyID)
	if err != nil {
		return fmt.Errorf("delete existing property tags: %w", err)
	}

	// Add new tags
	now := formatTime(time.Now().UTC())
	for _, tagID := range tagIDs {
		_, err = tx.ExecContext(
			ctx,
			`INSERT INTO property_tags (property_id, tag_id, assigned_at) VALUES (?, ?, ?)`,
			propertyID,
			tagID,
			now,
		)
		if err != nil {
			return fmt.Errorf("assign tag: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit assign tags: %w", err)
	}

	return nil
}

// AddPropertyTag adds a single tag to a property.
func (s *Store) AddPropertyTag(ctx context.Context, propertyID, tagID string) error {
	now := formatTime(time.Now().UTC())
	_, err := s.db.ExecContext(
		ctx,
		`INSERT OR IGNORE INTO property_tags (property_id, tag_id, assigned_at) VALUES (?, ?, ?)`,
		propertyID,
		tagID,
		now,
	)
	if err != nil {
		return fmt.Errorf("add property tag: %w", err)
	}
	return nil
}

// RemovePropertyTag removes a single tag from a property.
func (s *Store) RemovePropertyTag(ctx context.Context, propertyID, tagID string) error {
	_, err := s.db.ExecContext(
		ctx,
		`DELETE FROM property_tags WHERE property_id = ? AND tag_id = ?`,
		propertyID,
		tagID,
	)
	if err != nil {
		return fmt.Errorf("remove property tag: %w", err)
	}
	return nil
}

// ListPropertyTags returns all tags assigned to a property.
func (s *Store) ListPropertyTags(ctx context.Context, propertyID string) ([]ingestiondomain.Tag, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT t.id, t.name, t.color, t.created_at, t.updated_at
		 FROM tags t
		 JOIN property_tags pt ON pt.tag_id = t.id
		 WHERE pt.property_id = ?
		 ORDER BY t.name ASC, t.id ASC`,
		propertyID,
	)
	if err != nil {
		return nil, fmt.Errorf("list property tags: %w", err)
	}
	defer rows.Close()

	tags := make([]ingestiondomain.Tag, 0)
	for rows.Next() {
		tag, err := scanTag(rows)
		if err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}

	return tags, rows.Err()
}

// ListPropertiesByTagIDs returns property IDs that match the given tags.
func (s *Store) ListPropertiesByTagIDs(ctx context.Context, tagIDs []string, matchAll bool) ([]string, error) {
	if len(tagIDs) == 0 {
		return []string{}, nil
	}

	var query string
	args := make([]any, len(tagIDs))
	for i, tagID := range tagIDs {
		args[i] = tagID
	}

	if matchAll {
		// Match properties that have ALL the specified tags
		placeholders := strings.Repeat("?,", len(tagIDs))
		placeholders = placeholders[:len(placeholders)-1]
		query = fmt.Sprintf(`
			SELECT property_id
			FROM property_tags
			WHERE tag_id IN (%s)
			GROUP BY property_id
			HAVING COUNT(DISTINCT tag_id) = ?
		`, placeholders)
		args = append(args, len(tagIDs))
	} else {
		// Match properties that have ANY of the specified tags
		placeholders := strings.Repeat("?,", len(tagIDs))
		placeholders = placeholders[:len(placeholders)-1]
		query = fmt.Sprintf(`
			SELECT DISTINCT property_id
			FROM property_tags
			WHERE tag_id IN (%s)
		`, placeholders)
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list properties by tags: %w", err)
	}
	defer rows.Close()

	propertyIDs := make([]string, 0)
	for rows.Next() {
		var propertyID string
		if err := rows.Scan(&propertyID); err != nil {
			return nil, err
		}
		propertyIDs = append(propertyIDs, propertyID)
	}

	return propertyIDs, rows.Err()
}

// CreatePropertyRun inserts a new property run.
func (s *Store) CreatePropertyRun(ctx context.Context, run ingestiondomain.PropertyRun) error {
	_, err := s.db.ExecContext(
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
		run.ErrorMessage,
		run.SnapshotID,
		formatTime(run.CreatedAt),
	)
	if err != nil {
		return fmt.Errorf("create property run: %w", err)
	}
	return nil
}

// UpdatePropertyRun updates an existing property run.
func (s *Store) UpdatePropertyRun(ctx context.Context, run ingestiondomain.PropertyRun) error {
	_, err := s.db.ExecContext(
		ctx,
		`UPDATE property_runs
		 SET status = ?, attempt_count = ?, started_at = ?, finished_at = ?, error_message = ?, snapshot_id = ?
		 WHERE id = ?`,
		string(run.Status),
		run.AttemptCount,
		nullableTimeString(run.StartedAt),
		nullableTimeString(run.FinishedAt),
		run.ErrorMessage,
		run.SnapshotID,
		run.ID,
	)
	if err != nil {
		return fmt.Errorf("update property run: %w", err)
	}
	return nil
}

// ListPropertyRuns returns recent runs for a property.
func (s *Store) ListPropertyRuns(ctx context.Context, propertyID string, limit int) ([]ingestiondomain.PropertyRun, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, property_id, status, trigger_kind, attempt_count, max_attempts, started_at, finished_at, error_message, snapshot_id, created_at
		 FROM property_runs
		 WHERE property_id = ?
		 ORDER BY started_at DESC, id DESC
		 LIMIT ?`,
		propertyID,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("list property runs: %w", err)
	}
	defer rows.Close()

	runs := make([]ingestiondomain.PropertyRun, 0)
	for rows.Next() {
		run, err := scanPropertyRun(rows)
		if err != nil {
			return nil, err
		}
		runs = append(runs, run)
	}

	return runs, rows.Err()
}

// GetPropertyRun returns a single property run by ID.
func (s *Store) GetPropertyRun(ctx context.Context, runID string) (ingestiondomain.PropertyRun, error) {
	run, err := scanPropertyRun(s.db.QueryRowContext(
		ctx,
		`SELECT id, property_id, status, trigger_kind, attempt_count, max_attempts, started_at, finished_at, error_message, snapshot_id, created_at
		 FROM property_runs
		 WHERE id = ?`,
		runID,
	))
	if err != nil {
		return ingestiondomain.PropertyRun{}, err
	}
	return run, nil
}

// CountRecentPropertyRuns counts runs for a property since a given time.
func (s *Store) CountRecentPropertyRuns(ctx context.Context, propertyID string, since time.Time) (int, error) {
	var count int
	err := s.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM property_runs WHERE property_id = ? AND started_at >= ?`,
		propertyID,
		formatTime(since),
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count recent property runs: %w", err)
	}
	return count, nil
}

// GetPlatformSettings returns the singleton platform settings row.
func (s *Store) GetPlatformSettings(ctx context.Context) (platformopsdomain.PlatformSettings, error) {
	row := s.db.QueryRowContext(
		ctx,
		`SELECT id, scheduler_enabled, maintenance_window_enabled, maintenance_window_start, maintenance_window_end,
		        webhook_url, webhook_events_json, slack_webhook_url, slack_events_json,
		        spreadsheet_webhook_url, spreadsheet_events_json, task_webhook_url, task_events_json,
		        email_digest_enabled, email_digest_recipient, email_digest_schedule, email_digest_events_json,
		        last_digest_sent_at, updated_at
		   FROM platform_settings
		  ORDER BY updated_at DESC
		  LIMIT 1`,
	)

	var (
		settings                                                       platformopsdomain.PlatformSettings
		schedulerEnabled, maintenanceWindowEnabled, emailDigestEnabled int
		webhookEventsJSON, slackEventsJSON, spreadsheetEventsJSON      string
		taskEventsJSON, emailDigestEventsJSON                          string
		lastDigestSentAt                                               sql.NullString
		updatedAt                                                      string
	)

	err := row.Scan(
		&settings.ID,
		&schedulerEnabled,
		&maintenanceWindowEnabled,
		&settings.MaintenanceWindowStart,
		&settings.MaintenanceWindowEnd,
		&settings.Webhook.URL,
		&webhookEventsJSON,
		&settings.Slack.URL,
		&slackEventsJSON,
		&settings.Spreadsheet.URL,
		&spreadsheetEventsJSON,
		&settings.TaskSystem.URL,
		&taskEventsJSON,
		&emailDigestEnabled,
		&settings.EmailDigest.Recipient,
		&settings.EmailDigest.Schedule,
		&emailDigestEventsJSON,
		&lastDigestSentAt,
		&updatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		now := time.Now().UTC()
		return platformopsdomain.PlatformSettings{
			ID:               "platform",
			SchedulerEnabled: true,
			EmailDigest: platformopsdomain.EmailDigestConfig{
				Schedule: "09:00",
			},
			UpdatedAt: now,
		}, nil
	}
	if err != nil {
		return platformopsdomain.PlatformSettings{}, fmt.Errorf("get platform settings: %w", err)
	}

	settings.SchedulerEnabled = schedulerEnabled == 1
	settings.MaintenanceWindowEnabled = maintenanceWindowEnabled == 1
	settings.EmailDigest.Enabled = emailDigestEnabled == 1
	settings.Webhook.Events = decodeStringArrayJSON(webhookEventsJSON)
	settings.Slack.Events = decodeStringArrayJSON(slackEventsJSON)
	settings.Spreadsheet.Events = decodeStringArrayJSON(spreadsheetEventsJSON)
	settings.TaskSystem.Events = decodeStringArrayJSON(taskEventsJSON)
	settings.EmailDigest.Events = decodeStringArrayJSON(emailDigestEventsJSON)
	if lastDigestSentAt.Valid {
		parsed, err := parseTime(lastDigestSentAt.String)
		if err != nil {
			return platformopsdomain.PlatformSettings{}, err
		}
		settings.EmailDigest.LastSentAt = &parsed
	}
	parsedUpdatedAt, err := parseTime(updatedAt)
	if err != nil {
		return platformopsdomain.PlatformSettings{}, err
	}
	settings.UpdatedAt = parsedUpdatedAt
	return settings, nil
}

// SavePlatformSettings stores the singleton platform settings row.
func (s *Store) SavePlatformSettings(ctx context.Context, settings platformopsdomain.PlatformSettings) error {
	if strings.TrimSpace(settings.ID) == "" {
		settings.ID = "platform"
	}
	if strings.TrimSpace(settings.EmailDigest.Schedule) == "" {
		settings.EmailDigest.Schedule = "09:00"
	}
	settings.UpdatedAt = time.Now().UTC()

	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO platform_settings (
			id, scheduler_enabled, maintenance_window_enabled, maintenance_window_start, maintenance_window_end,
			webhook_url, webhook_events_json, slack_webhook_url, slack_events_json,
			spreadsheet_webhook_url, spreadsheet_events_json, task_webhook_url, task_events_json,
			email_digest_enabled, email_digest_recipient, email_digest_schedule, email_digest_events_json,
			last_digest_sent_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			scheduler_enabled = excluded.scheduler_enabled,
			maintenance_window_enabled = excluded.maintenance_window_enabled,
			maintenance_window_start = excluded.maintenance_window_start,
			maintenance_window_end = excluded.maintenance_window_end,
			webhook_url = excluded.webhook_url,
			webhook_events_json = excluded.webhook_events_json,
			slack_webhook_url = excluded.slack_webhook_url,
			slack_events_json = excluded.slack_events_json,
			spreadsheet_webhook_url = excluded.spreadsheet_webhook_url,
			spreadsheet_events_json = excluded.spreadsheet_events_json,
			task_webhook_url = excluded.task_webhook_url,
			task_events_json = excluded.task_events_json,
			email_digest_enabled = excluded.email_digest_enabled,
			email_digest_recipient = excluded.email_digest_recipient,
			email_digest_schedule = excluded.email_digest_schedule,
			email_digest_events_json = excluded.email_digest_events_json,
			last_digest_sent_at = excluded.last_digest_sent_at,
			updated_at = excluded.updated_at`,
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
		return fmt.Errorf("save platform settings: %w", err)
	}
	return nil
}

// CreateIntegrationDeliveryLog records one delivery attempt.
func (s *Store) CreateIntegrationDeliveryLog(ctx context.Context, log platformopsdomain.IntegrationDeliveryLog) error {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO integration_delivery_logs (id, channel, event_type, target, status, attempt_count, payload_json, response_status, error_message, delivered_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		log.ID,
		log.Channel,
		log.EventType,
		log.Target,
		log.Status,
		log.AttemptCount,
		normalizeJSONString(string(log.Payload)),
		nullableInt(log.ResponseStatus),
		nullableString(log.ErrorMessage),
		nullableTimeString(log.DeliveredAt),
		formatTime(log.CreatedAt),
	)
	if err != nil {
		return fmt.Errorf("create integration delivery log: %w", err)
	}
	return nil
}

// ListIntegrationDeliveryLogs returns recent integration activity.
func (s *Store) ListIntegrationDeliveryLogs(ctx context.Context, limit int) ([]platformopsdomain.IntegrationDeliveryLog, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, channel, event_type, target, status, attempt_count, payload_json, response_status, error_message, delivered_at, created_at
		   FROM integration_delivery_logs
		  ORDER BY created_at DESC, id DESC
		  LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("list integration delivery logs: %w", err)
	}
	defer rows.Close()

	items := make([]platformopsdomain.IntegrationDeliveryLog, 0, limit)
	for rows.Next() {
		var (
			item                      platformopsdomain.IntegrationDeliveryLog
			payloadJSON, createdAt    string
			responseStatus            sql.NullInt64
			errorMessage, deliveredAt sql.NullString
		)
		if err := rows.Scan(
			&item.ID,
			&item.Channel,
			&item.EventType,
			&item.Target,
			&item.Status,
			&item.AttemptCount,
			&payloadJSON,
			&responseStatus,
			&errorMessage,
			&deliveredAt,
			&createdAt,
		); err != nil {
			return nil, err
		}
		item.Payload = json.RawMessage(normalizeJSONString(payloadJSON))
		if responseStatus.Valid {
			item.ResponseStatus = int(responseStatus.Int64)
		}
		if errorMessage.Valid {
			item.ErrorMessage = errorMessage.String
		}
		if deliveredAt.Valid {
			parsed, err := parseTime(deliveredAt.String)
			if err != nil {
				return nil, err
			}
			item.DeliveredAt = &parsed
		}
		parsedCreatedAt, err := parseTime(createdAt)
		if err != nil {
			return nil, err
		}
		item.CreatedAt = parsedCreatedAt
		items = append(items, item)
	}
	return items, rows.Err()
}

// CountProperties returns the total property count.
func (s *Store) CountProperties(ctx context.Context) (int, error) {
	var count int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM properties`).Scan(&count); err != nil {
		return 0, fmt.Errorf("count properties: %w", err)
	}
	return count, nil
}

// CountPausedProperties returns the total paused property count.
func (s *Store) CountPausedProperties(ctx context.Context) (int, error) {
	var count int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM properties WHERE paused = 1`).Scan(&count); err != nil {
		return 0, fmt.Errorf("count paused properties: %w", err)
	}
	return count, nil
}

// CountDueProperties returns properties that are currently runnable.
func (s *Store) CountDueProperties(ctx context.Context, before time.Time) (int, error) {
	var count int
	if err := s.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM properties WHERE status != 'inactive' AND paused = 0 AND schedule_interval_seconds > 0 AND (next_run_at IS NULL OR next_run_at <= ?)`,
		formatTime(before),
	).Scan(&count); err != nil {
		return 0, fmt.Errorf("count due properties: %w", err)
	}
	return count, nil
}

// CountPropertyRunsSince returns total and failed run counts since the given time.
func (s *Store) CountPropertyRunsSince(ctx context.Context, since time.Time) (int, int, error) {
	var total, failed int
	if err := s.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*), COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) FROM property_runs WHERE created_at >= ?`,
		formatTime(since),
	).Scan(&total, &failed); err != nil {
		return 0, 0, fmt.Errorf("count property runs since: %w", err)
	}
	return total, failed, nil
}

func scanTag(s scanner) (ingestiondomain.Tag, error) {
	var (
		tag                  ingestiondomain.Tag
		createdAt, updatedAt string
	)

	err := s.Scan(
		&tag.ID,
		&tag.Name,
		&tag.Color,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return ingestiondomain.Tag{}, err
	}

	tag.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return ingestiondomain.Tag{}, err
	}
	tag.UpdatedAt, err = parseTime(updatedAt)
	if err != nil {
		return ingestiondomain.Tag{}, err
	}

	return tag, nil
}

func scanPropertyRun(s scanner) (ingestiondomain.PropertyRun, error) {
	var (
		run                      ingestiondomain.PropertyRun
		status                   string
		startedAt, finishedAt    sql.NullString
		errorMessage, snapshotID sql.NullString
		createdAt                string
	)

	err := s.Scan(
		&run.ID,
		&run.PropertyID,
		&status,
		&run.TriggerKind,
		&run.AttemptCount,
		&run.MaxAttempts,
		&startedAt,
		&finishedAt,
		&errorMessage,
		&snapshotID,
		&createdAt,
	)
	if err != nil {
		return ingestiondomain.PropertyRun{}, err
	}

	run.Status = ingestiondomain.PropertyRunStatus(status)
	if startedAt.Valid {
		parsedStartedAt, err := parseTime(startedAt.String)
		if err != nil {
			return ingestiondomain.PropertyRun{}, err
		}
		run.StartedAt = &parsedStartedAt
	}
	if finishedAt.Valid {
		parsedFinishedAt, err := parseTime(finishedAt.String)
		if err != nil {
			return ingestiondomain.PropertyRun{}, err
		}
		run.FinishedAt = &parsedFinishedAt
	}
	if errorMessage.Valid {
		run.ErrorMessage = errorMessage.String
	}
	if snapshotID.Valid {
		run.SnapshotID = snapshotID.String
	}
	run.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return ingestiondomain.PropertyRun{}, err
	}

	return run, nil
}
