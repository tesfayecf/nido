/**
 * File: internal/auth/application/service.go
 *
 * Purpose:
 * Coordinates application-level backend use cases, validation, and persistence boundaries.
 *
 * Responsibilities:
 * - Apply business rules
 * - Coordinate repositories and domain models
 * - Return typed results for transport layers
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - context
 * - crypto/rand
 * - crypto/sha256
 * - encoding/hex
 * - errors
 * - fmt
 * - log/slog
 * - strings
 * - time
 * - golang.org/x/crypto/bcrypt
 * - nido/server/internal/auth/domain
 * - nido/server/internal/platform/config
 * - nido/server/internal/platform/id
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package application

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	authdomain "nido/server/internal/auth/domain"
	platformconfig "nido/server/internal/platform/config"
	"nido/server/internal/platform/id"
)

var (
	// ErrInvalidCredentials indicates that the supplied login credentials are invalid.
	ErrInvalidCredentials = errors.New("invalid credentials")
	// ErrUnauthorized indicates that the bearer token is not valid.
	ErrUnauthorized = errors.New("unauthorized")
	// ErrInvalidPassword indicates the supplied current password did not match.
	ErrInvalidPassword = errors.New("invalid current password")
	// ErrPasswordTooWeak indicates the new password failed minimum policy.
	ErrPasswordTooWeak = errors.New("new password must be at least 8 characters")
	// ErrInvalidProfile indicates the profile payload contained invalid values.
	ErrInvalidProfile = errors.New("invalid profile fields")
)

/**
 * @critical
 * Description: Bearer tokens are generated once, stored only as hashes, and authorize protected backend routes.
 * Why critical: Token disclosure or weak bootstrap credentials can grant access to user and operations APIs.
 * What can break: Account integrity, workspace data confidentiality, and operational settings.
 * Failure conditions: Leaked bearer tokens, insecure bootstrap password, missing transport security, or stale sessions not revoked.
 */

/**
 * Purpose:
 * Defines the Store interface used by this package and its consumers.
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
type Store interface {
	UpsertUser(ctx context.Context, user authdomain.User, passwordHash string) error
	GetUserByEmail(ctx context.Context, email string) (authdomain.User, string, error)
	GetUserByID(ctx context.Context, userID string) (authdomain.User, error)
	GetUserCredentials(ctx context.Context, userID string) (string, error)
	UpdateUserProfile(ctx context.Context, userID, displayName string, updatedAt time.Time) error
	UpdateUserPassword(ctx context.Context, userID, passwordHash string, updatedAt time.Time) error
	CreateSession(ctx context.Context, session authdomain.Session, tokenHash string) error
	GetSessionByTokenHash(ctx context.Context, tokenHash string) (authdomain.Session, authdomain.User, error)
	RevokeSession(ctx context.Context, sessionID string, revokedAt time.Time) error
}

/**
 * Purpose:
 * Defines the Service struct used by this package and its consumers.
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
type Service struct {
	logger *slog.Logger
	store  Store
	cfg    platformconfig.AuthConfig
}

/**
 * Purpose:
 * Performs the NewService operation for this backend package.
 *
 * Parameters:
 * - logger *slog.Logger, store Store, cfg platformconfig.AuthConfig
 *
 * Returns:
 * - *Service
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
func NewService(logger *slog.Logger, store Store, cfg platformconfig.AuthConfig) *Service {
	return &Service{logger: logger, store: store, cfg: cfg}
}

/**
 * Purpose:
 * Performs the EnsureBootstrapUser operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - EnsureBootstrapUser(ctx context.Context) (authdomain.User, error)
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
func (s *Service) EnsureBootstrapUser(ctx context.Context) (authdomain.User, error) {
	email := strings.ToLower(strings.TrimSpace(s.cfg.BootstrapAdminEmail))
	password := strings.TrimSpace(s.cfg.BootstrapAdminPassword)
	if email == "" || password == "" {
		return authdomain.User{}, fmt.Errorf("bootstrap admin email and password must be configured")
	}

	now := time.Now().UTC()
	user := authdomain.User{
		ID:          id.Deterministic("usr", email),
		Email:       email,
		DisplayName: strings.TrimSpace(s.cfg.BootstrapAdminName),
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if user.DisplayName == "" {
		user.DisplayName = "Administrator"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return authdomain.User{}, fmt.Errorf("hash bootstrap password: %w", err)
	}

	if err := s.store.UpsertUser(ctx, user, string(hash)); err != nil {
		return authdomain.User{}, err
	}

	return user, nil
}

/**
 * Purpose:
 * Performs the Login operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - Login(ctx context.Context, email, password string) (authdomain.User, authdomain.Session, string, error)
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
func (s *Service) Login(ctx context.Context, email, password string) (authdomain.User, authdomain.Session, string, error) {
	user, passwordHash, err := s.store.GetUserByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if err != nil {
		return authdomain.User{}, authdomain.Session{}, "", ErrInvalidCredentials
	}

	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)) != nil {
		return authdomain.User{}, authdomain.Session{}, "", ErrInvalidCredentials
	}

	rawToken, tokenHash, err := newToken()
	if err != nil {
		return authdomain.User{}, authdomain.Session{}, "", err
	}

	now := time.Now().UTC()
	session := authdomain.Session{
		ID:        id.New("sess"),
		UserID:    user.ID,
		CreatedAt: now,
		ExpiresAt: now.Add(s.cfg.SessionTTL),
	}

	if err := s.store.CreateSession(ctx, session, tokenHash); err != nil {
		return authdomain.User{}, authdomain.Session{}, "", err
	}

	s.logger.Info("session created", "user_id", user.ID, "session_id", session.ID)

	return user, session, rawToken, nil
}

/**
 * Purpose:
 * Performs the AuthenticateToken operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - AuthenticateToken(ctx context.Context, token string) (authdomain.User, authdomain.Session, error)
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
func (s *Service) AuthenticateToken(ctx context.Context, token string) (authdomain.User, authdomain.Session, error) {
	trimmed := strings.TrimSpace(token)
	if trimmed == "" {
		return authdomain.User{}, authdomain.Session{}, ErrUnauthorized
	}

	session, user, err := s.store.GetSessionByTokenHash(ctx, tokenHash(trimmed))
	if err != nil {
		return authdomain.User{}, authdomain.Session{}, ErrUnauthorized
	}

	now := time.Now().UTC()
	if session.RevokedAt != nil || session.ExpiresAt.Before(now) {
		return authdomain.User{}, authdomain.Session{}, ErrUnauthorized
	}

	return user, session, nil
}

/**
 * Purpose:
 * Performs the Logout operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - Logout(ctx context.Context, sessionID string) error
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
func (s *Service) Logout(ctx context.Context, sessionID string) error {
	return s.store.RevokeSession(ctx, sessionID, time.Now().UTC())
}

/**
 * Purpose:
 * Performs the UpdateProfile operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - UpdateProfile(ctx context.Context, userID, displayName string) (authdomain.User, error)
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
func (s *Service) UpdateProfile(ctx context.Context, userID, displayName string) (authdomain.User, error) {
	trimmed := strings.TrimSpace(displayName)
	if trimmed == "" {
		return authdomain.User{}, ErrInvalidProfile
	}

	now := time.Now().UTC()
	if err := s.store.UpdateUserProfile(ctx, userID, trimmed, now); err != nil {
		return authdomain.User{}, err
	}

	return s.store.GetUserByID(ctx, userID)
}

/**
 * Purpose:
 * Performs the ChangePassword operation for this backend package.
 *
 * Parameters:
 * - s *Service
 *
 * Returns:
 * - ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error
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
func (s *Service) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	if len(strings.TrimSpace(newPassword)) < 8 {
		return ErrPasswordTooWeak
	}

	currentHash, err := s.store.GetUserCredentials(ctx, userID)
	if err != nil {
		return ErrInvalidPassword
	}

	if bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(currentPassword)) != nil {
		return ErrInvalidPassword
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	return s.store.UpdateUserPassword(ctx, userID, string(newHash), time.Now().UTC())
}

/**
 * Purpose:
 * Performs the newToken operation for this backend package.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - (string, string, error)
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
func newToken() (string, string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", "", fmt.Errorf("generate auth token: %w", err)
	}

	rawToken := hex.EncodeToString(buffer)
	return rawToken, tokenHash(rawToken), nil
}

/**
 * Purpose:
 * Performs the tokenHash operation for this backend package.
 *
 * Parameters:
 * - token string
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
func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
