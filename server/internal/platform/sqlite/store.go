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

	authdomain "home-searcher/server/internal/auth/domain"
	"home-searcher/server/internal/catalog/domain"
	engagementdomain "home-searcher/server/internal/engagement/domain"
	ingestiondomain "home-searcher/server/internal/ingestion/domain"
	"home-searcher/server/internal/platform/id"
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
	rows, err := s.db.QueryContext(ctx, sourceSelect+` ORDER BY name ASC`)
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
	_, err := s.db.ExecContext(ctx, `DELETE FROM sources WHERE id = ?`, sourceID)
	if err != nil {
		return fmt.Errorf("delete source: %w", err)
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

	query += ` ORDER BY started_at DESC LIMIT ?`
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
		            ORDER BY observed_at DESC
		            LIMIT 1
		        ), '{}')
		 FROM bookmarks b
		 JOIN properties p ON p.id = b.property_id
		 WHERE b.user_id = ?
		 ORDER BY b.created_at DESC`,
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
			label      string
			valuesJSON string
			createdAt  string
		)
		if err := rows.Scan(&item.PropertyID, &item.SourceID, &label, &item.URL, &createdAt, &valuesJSON); err != nil {
			return nil, fmt.Errorf("scan bookmark: %w", err)
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
	rows, err := s.db.QueryContext(ctx, `SELECT id, user_id, name, query, source_id, max_price_amount, created_at, updated_at FROM watchlists WHERE user_id = ? ORDER BY created_at DESC`, userID)
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
	rows, err := s.db.QueryContext(ctx, `SELECT id, user_id, name, query, source_id, max_price_amount, created_at, updated_at FROM watchlists ORDER BY created_at DESC`)
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
	rows, err := s.db.QueryContext(ctx, `SELECT id, user_id, property_id, rule_type, threshold_amount, enabled, created_at, updated_at FROM alert_rules WHERE user_id = ? ORDER BY created_at DESC`, userID)
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
	rows, err := s.db.QueryContext(ctx, `SELECT id, user_id, property_id, rule_type, threshold_amount, enabled, created_at, updated_at FROM alert_rules WHERE enabled = 1 ORDER BY created_at DESC`)
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
	query += ` ORDER BY created_at DESC LIMIT ?`
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

// ListListings returns the catalog listing read model.
func (s *Store) ListListings(ctx context.Context, query domain.ListQuery) ([]domain.Listing, error) {
	statement := `SELECT id, source_id, external_id, title, price_amount, currency, location, url, first_seen_at, last_seen_at, latest_snapshot_at FROM listings`
	args := make([]any, 0, 3)

	filters := make([]string, 0, 2)
	if strings.TrimSpace(query.SourceID) != "" {
		filters = append(filters, `source_id = ?`)
		args = append(args, query.SourceID)
	}
	if strings.TrimSpace(query.Query) != "" {
		filters = append(filters, `(LOWER(title) LIKE LOWER(?) OR LOWER(location) LIKE LOWER(?))`)
		search := "%" + query.Query + "%"
		args = append(args, search, search)
	}
	if len(filters) > 0 {
		statement += ` WHERE ` + strings.Join(filters, ` AND `)
	}

	statement += ` ORDER BY last_seen_at DESC LIMIT ?`
	args = append(args, query.Limit)

	rows, err := s.db.QueryContext(ctx, statement, args...)
	if err != nil {
		return nil, fmt.Errorf("list listings: %w", err)
	}
	defer rows.Close()

	items := make([]domain.Listing, 0)
	for rows.Next() {
		listing, err := scanListing(rows)
		if err != nil {
			return nil, err
		}

		items = append(items, listing)
	}

	return items, rows.Err()
}

// GetListing returns one listing and its price history.
func (s *Store) GetListing(ctx context.Context, listingID string) (domain.Listing, []domain.PriceEvent, error) {
	listing, err := scanListing(s.db.QueryRowContext(ctx, `SELECT id, source_id, external_id, title, price_amount, currency, location, url, first_seen_at, last_seen_at, latest_snapshot_at FROM listings WHERE id = ?`, listingID))
	if err != nil {
		return domain.Listing{}, nil, err
	}

	historyRows, err := s.db.QueryContext(ctx, `SELECT id, listing_id, previous_amount, new_amount, changed_at FROM price_events WHERE listing_id = ? ORDER BY changed_at DESC`, listingID)
	if err != nil {
		return domain.Listing{}, nil, fmt.Errorf("list price history: %w", err)
	}
	defer historyRows.Close()

	history := make([]domain.PriceEvent, 0)
	for historyRows.Next() {
		var (
			event          domain.PriceEvent
			previousAmount sql.NullInt64
			changedAt      string
		)

		if err := historyRows.Scan(&event.ID, &event.ListingID, &previousAmount, &event.NewAmount, &changedAt); err != nil {
			return domain.Listing{}, nil, fmt.Errorf("scan price event: %w", err)
		}

		if previousAmount.Valid {
			value := previousAmount.Int64
			event.PreviousAmount = &value
		}
		parsedChangedAt, err := parseTime(changedAt)
		if err != nil {
			return domain.Listing{}, nil, err
		}
		event.ChangedAt = parsedChangedAt

		history = append(history, event)
	}

	return listing, history, historyRows.Err()
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

func scanListing(scanner scanner) (domain.Listing, error) {
	var (
		listing                                   domain.Listing
		firstSeenAt, lastSeenAt, latestSnapshotAt string
	)

	err := scanner.Scan(
		&listing.ID,
		&listing.SourceID,
		&listing.ExternalID,
		&listing.Title,
		&listing.PriceAmount,
		&listing.Currency,
		&listing.Location,
		&listing.URL,
		&firstSeenAt,
		&lastSeenAt,
		&latestSnapshotAt,
	)
	if err != nil {
		return domain.Listing{}, err
	}

	listing.FirstSeenAt, err = parseTime(firstSeenAt)
	if err != nil {
		return domain.Listing{}, err
	}
	listing.LastSeenAt, err = parseTime(lastSeenAt)
	if err != nil {
		return domain.Listing{}, err
	}
	listing.LatestSnapshotAt, err = parseTime(latestSnapshotAt)
	if err != nil {
		return domain.Listing{}, err
	}

	return listing, nil
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

// ── Property persistence ──────────────────────────────────────────────────────

var propertySelect = `SELECT id, url, label, source_id, status, schedule_interval_seconds, retry_max_attempts, retry_backoff_millis, last_run_at, next_run_at, created_at, updated_at FROM properties`

// UpsertProperty creates or updates a property record.
func (s *Store) UpsertProperty(ctx context.Context, property ingestiondomain.Property) error {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO properties (id, url, label, source_id, status, schedule_interval_seconds, retry_max_attempts, retry_backoff_millis, last_run_at, next_run_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		 	url = excluded.url,
		 	label = excluded.label,
		 	source_id = excluded.source_id,
		 	status = excluded.status,
		 	schedule_interval_seconds = excluded.schedule_interval_seconds,
		 	retry_max_attempts = excluded.retry_max_attempts,
		 	retry_backoff_millis = excluded.retry_backoff_millis,
		 	last_run_at = excluded.last_run_at,
		 	next_run_at = excluded.next_run_at,
		 	updated_at = excluded.updated_at`,
		property.ID,
		property.URL,
		property.Label,
		nullableString(property.SourceID),
		string(property.Status),
		property.ScheduleIntervalSeconds,
		property.RetryMaxAttempts,
		property.RetryBackoffMillis,
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
	rows, err := s.db.QueryContext(ctx, propertySelect+` ORDER BY created_at DESC`)
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
		propertySelect+` WHERE status != 'inactive' AND schedule_interval_seconds > 0 AND (next_run_at IS NULL OR next_run_at <= ?) ORDER BY COALESCE(next_run_at, created_at) ASC LIMIT ?`,
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
		`INSERT INTO property_extraction_configs (id, property_id, fields_json, version, created_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET fields_json = excluded.fields_json, version = excluded.version`,
		config.ID,
		config.PropertyID,
		string(fieldsJSON),
		config.Version,
		formatTime(config.CreatedAt),
	)
	if err != nil {
		return fmt.Errorf("upsert property config: %w", err)
	}

	return nil
}

// GetLatestPropertyConfig returns the most recent config for a property.
// Returns an empty config (not an error) when no config exists yet.
func (s *Store) GetLatestPropertyConfig(ctx context.Context, propertyID string) (ingestiondomain.PropertyExtractionConfig, error) {
	var (
		config     ingestiondomain.PropertyExtractionConfig
		fieldsJSON string
		createdAt  string
	)

	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, property_id, fields_json, version, created_at FROM property_extraction_configs WHERE property_id = ? ORDER BY version DESC LIMIT 1`,
		propertyID,
	).Scan(&config.ID, &config.PropertyID, &fieldsJSON, &config.Version, &createdAt)
	if errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.PropertyExtractionConfig{
			PropertyID: propertyID,
			Fields:     []ingestiondomain.FieldSelector{},
		}, nil
	}
	if err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, fmt.Errorf("get latest property config: %w", err)
	}

	if err := json.Unmarshal([]byte(fieldsJSON), &config.Fields); err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, fmt.Errorf("unmarshal property fields: %w", err)
	}
	if config.Fields == nil {
		config.Fields = []ingestiondomain.FieldSelector{}
	}

	config.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return ingestiondomain.PropertyExtractionConfig{}, err
	}

	return config, nil
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
		`SELECT id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message FROM property_snapshots WHERE property_id = ? ORDER BY observed_at DESC LIMIT ?`,
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
	query += ` ORDER BY observed_at DESC LIMIT ?`
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

// GetLastValidPropertySnapshot returns the most recent valid snapshot for a property.
func (s *Store) GetLastValidPropertySnapshot(ctx context.Context, propertyID string) (ingestiondomain.PropertySnapshot, error) {
	snapshot, err := scanPropertySnapshot(s.db.QueryRowContext(
		ctx,
		`SELECT id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message FROM property_snapshots WHERE property_id = ? AND is_valid = 1 ORDER BY observed_at DESC LIMIT 1`,
		propertyID,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.PropertySnapshot{PropertyID: propertyID}, nil
	}

	return snapshot, err
}

func scanProperty(s scanner) (ingestiondomain.Property, error) {
	var (
		property             ingestiondomain.Property
		sourceID             sql.NullString
		status               string
		lastRunAt, nextRunAt sql.NullString
		createdAt, updatedAt string
	)

	err := s.Scan(
		&property.ID,
		&property.URL,
		&property.Label,
		&sourceID,
		&status,
		&property.ScheduleIntervalSeconds,
		&property.RetryMaxAttempts,
		&property.RetryBackoffMillis,
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

	property.Status = ingestiondomain.PropertyStatus(status)
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
