package domain

import (
	"encoding/json"
	"time"
)

const (
	// RuleTypePriceDrop notifies when a tracked property drops in price.
	RuleTypePriceDrop = "price_drop"
	// RuleTypePriceBelow notifies when a tracked property reaches a threshold.
	RuleTypePriceBelow = "price_below"
	// RuleTypePriceAbove notifies when a tracked property exceeds a threshold.
	RuleTypePriceAbove = "price_above"
	// RuleTypeAnyChange notifies when any tracked field changes between snapshots.
	RuleTypeAnyChange = "any_change"
)

var supportedRuleTypes = map[string]struct{}{
	RuleTypePriceDrop:  {},
	RuleTypePriceBelow: {},
	RuleTypePriceAbove: {},
	RuleTypeAnyChange:  {},
}

// IsSupportedRuleType reports whether the provided rule type is implemented.
func IsSupportedRuleType(ruleType string) bool {
	_, ok := supportedRuleTypes[ruleType]
	return ok
}

// BookmarkedProperty is a saved property joined with its latest extracted data.
type BookmarkedProperty struct {
	BookmarkedAt time.Time `json:"bookmarked_at"`
	Currency     string    `json:"currency"`
	Location     string    `json:"location"`
	PriceAmount  int64     `json:"price_amount"`
	PropertyID   string    `json:"property_id"`
	SourceID     string    `json:"source_id,omitempty"`
	Title        string    `json:"title"`
	URL          string    `json:"url"`
}

// Watchlist stores a saved search definition for the current user.
type Watchlist struct {
	ID             string
	UserID         string
	Name           string
	Query          string
	SourceID       string
	MaxPriceAmount *int64
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// AlertRule defines a notification policy for one property.
type AlertRule struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	PropertyID      string    `json:"property_id"`
	RuleType        string    `json:"rule_type"`
	ThresholdAmount *int64    `json:"threshold_amount,omitempty"`
	Enabled         bool      `json:"enabled"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// Notification persists a generated alert for the user.
type Notification struct {
	ID             string          `json:"id"`
	UserID         string          `json:"user_id"`
	AlertID        string          `json:"alert_id,omitempty"`
	PropertyID     string          `json:"property_id,omitempty"`
	Kind           string          `json:"kind"`
	Title          string          `json:"title"`
	Body           string          `json:"body"`
	Data           json.RawMessage `json:"data,omitempty"`
	DeliveryStatus string          `json:"delivery_status"`
	CreatedAt      time.Time       `json:"created_at"`
	ReadAt         *time.Time      `json:"read_at,omitempty"`
}
