package domain

import (
	"encoding/json"
	"time"
)

const (
	// RuleTypeNewListing notifies when a new listing matches a watchlist.
	RuleTypeNewListing = "new_listing"
	// RuleTypePriceDrop notifies when a tracked listing drops in price.
	RuleTypePriceDrop = "price_drop"
	// RuleTypePriceBelow notifies when a listing reaches a threshold.
	RuleTypePriceBelow = "price_below"
)

var supportedRuleTypes = map[string]struct{}{
	RuleTypeNewListing: {},
	RuleTypePriceDrop:  {},
	RuleTypePriceBelow: {},
}

// IsSupportedRuleType reports whether the provided rule type is implemented.
func IsSupportedRuleType(ruleType string) bool {
	_, ok := supportedRuleTypes[ruleType]
	return ok
}

// BookmarkedListing is a saved listing joined with the current listing snapshot.
type BookmarkedListing struct {
	ListingID    string    `json:"listing_id"`
	SourceID     string    `json:"source_id"`
	Title        string    `json:"title"`
	PriceAmount  int64     `json:"price_amount"`
	Currency     string    `json:"currency"`
	Location     string    `json:"location"`
	URL          string    `json:"url"`
	BookmarkedAt time.Time `json:"bookmarked_at"`
}

// Watchlist stores user-defined listing filters.
type Watchlist struct {
	ID             string    `json:"id"`
	UserID         string    `json:"user_id"`
	Name           string    `json:"name"`
	Query          string    `json:"query,omitempty"`
	SourceID       string    `json:"source_id,omitempty"`
	MaxPriceAmount *int64    `json:"max_price_amount,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// AlertRule defines a notification policy for a listing or watchlist.
type AlertRule struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	WatchlistID     string    `json:"watchlist_id,omitempty"`
	ListingID       string    `json:"listing_id,omitempty"`
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
	RuleID         string          `json:"rule_id,omitempty"`
	ListingID      string          `json:"listing_id,omitempty"`
	Kind           string          `json:"kind"`
	Title          string          `json:"title"`
	Body           string          `json:"body"`
	Data           json.RawMessage `json:"data,omitempty"`
	DeliveryStatus string          `json:"delivery_status"`
	CreatedAt      time.Time       `json:"created_at"`
	ReadAt         *time.Time      `json:"read_at,omitempty"`
}
