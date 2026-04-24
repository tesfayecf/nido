package domain

import "time"

const (
	// RoleAdmin can manage workspace configuration and admin controls.
	RoleAdmin = "admin"
	// RoleOperator can collaborate on workspace properties and integrations.
	RoleOperator = "operator"
	// RoleViewer can read workspace data without mutating protected resources.
	RoleViewer = "viewer"
)

// User is the authenticated actor persisted by the backend.
type User struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	Role        string    `json:"role"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Session represents an issued bearer token session.
type Session struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt time.Time  `json:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
}
