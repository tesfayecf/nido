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

	authdomain "home-searcher/server/internal/auth/domain"
	platformconfig "home-searcher/server/internal/platform/config"
	"home-searcher/server/internal/platform/id"
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

// Store defines the persistence contract required by the auth service.
type Store interface {
	UpsertUser(ctx context.Context, user authdomain.User, passwordHash string) error
	GetUserByEmail(ctx context.Context, email string) (authdomain.User, string, error)
	GetUserByID(ctx context.Context, userID string) (authdomain.User, error)
	ListUsers(ctx context.Context) ([]authdomain.User, error)
	GetUserCredentials(ctx context.Context, userID string) (string, error)
	UpdateUserProfile(ctx context.Context, userID, displayName string, updatedAt time.Time) error
	UpdateUserPassword(ctx context.Context, userID, passwordHash string, updatedAt time.Time) error
	CreateSession(ctx context.Context, session authdomain.Session, tokenHash string) error
	GetSessionByTokenHash(ctx context.Context, tokenHash string) (authdomain.Session, authdomain.User, error)
	RevokeSession(ctx context.Context, sessionID string, revokedAt time.Time) error
}

// Service authenticates users and issues bearer sessions.
type Service struct {
	logger *slog.Logger
	store  Store
	cfg    platformconfig.AuthConfig
}

// NewService builds a new auth service.
func NewService(logger *slog.Logger, store Store, cfg platformconfig.AuthConfig) *Service {
	return &Service{logger: logger, store: store, cfg: cfg}
}

// EnsureBootstrapUser creates or updates the local bootstrap admin.
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
		Role:        authdomain.RoleAdmin,
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

// Login validates credentials and returns a new session token.
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

// AuthenticateToken validates a bearer token and returns the principal.
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

// Logout revokes a session.
func (s *Service) Logout(ctx context.Context, sessionID string) error {
	return s.store.RevokeSession(ctx, sessionID, time.Now().UTC())
}

// UpdateProfile updates the mutable profile fields of a user and returns the refreshed record.
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

// ChangePassword verifies the current password and stores a new bcrypt hash.
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

// ListUsers returns all workspace users ordered by display name.
func (s *Service) ListUsers(ctx context.Context) ([]authdomain.User, error) {
	return s.store.ListUsers(ctx)
}

// CreateUser creates a new workspace user.
func (s *Service) CreateUser(ctx context.Context, email, displayName, password, role string) (authdomain.User, error) {
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	normalizedName := strings.TrimSpace(displayName)
	normalizedRole := strings.TrimSpace(role)
	if normalizedEmail == "" || normalizedName == "" {
		return authdomain.User{}, ErrInvalidProfile
	}
	if len(strings.TrimSpace(password)) < 8 {
		return authdomain.User{}, ErrPasswordTooWeak
	}
	if !isValidRole(normalizedRole) {
		return authdomain.User{}, fmt.Errorf("invalid role")
	}

	now := time.Now().UTC()
	user := authdomain.User{
		ID:          id.Deterministic("usr", normalizedEmail),
		Email:       normalizedEmail,
		DisplayName: normalizedName,
		Role:        normalizedRole,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return authdomain.User{}, fmt.Errorf("hash user password: %w", err)
	}
	if err := s.store.UpsertUser(ctx, user, string(hash)); err != nil {
		return authdomain.User{}, err
	}
	return user, nil
}

// IsAdmin reports whether the supplied user has admin role.
func IsAdmin(user authdomain.User) bool {
	return strings.TrimSpace(user.Role) == authdomain.RoleAdmin
}

func isValidRole(role string) bool {
	switch role {
	case authdomain.RoleAdmin, authdomain.RoleOperator, authdomain.RoleViewer:
		return true
	default:
		return false
	}
}

func newToken() (string, string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", "", fmt.Errorf("generate auth token: %w", err)
	}

	rawToken := hex.EncodeToString(buffer)
	return rawToken, tokenHash(rawToken), nil
}

func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
