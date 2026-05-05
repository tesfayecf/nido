/**
 * File: internal/engagement/domain/models.go
 *
 * Purpose:
 * Defines domain data structures and normalization rules for this backend area.
 *
 * Responsibilities:
 * - Define data contracts
 * - Normalize values used across layers
 * - Keep business terminology centralized
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - encoding/json
 * - time
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

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
	// RuleTypeSignificantPriceChange notifies when price changes by a significant percentage.
	RuleTypeSignificantPriceChange = "significant_price_change"
	// RuleTypeStatusChange notifies when the listing status field changes.
	RuleTypeStatusChange = "status_change"
)

var supportedRuleTypes = map[string]struct{}{
	RuleTypePriceDrop:              {},
	RuleTypePriceBelow:             {},
	RuleTypePriceAbove:             {},
	RuleTypeAnyChange:              {},
	RuleTypeSignificantPriceChange: {},
	RuleTypeStatusChange:           {},
}

/**
 * Purpose:
 * Performs the IsSupportedRuleType operation for this backend package.
 *
 * Parameters:
 * - ruleType string
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
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func IsSupportedRuleType(ruleType string) bool {
	_, ok := supportedRuleTypes[ruleType]
	return ok
}

/**
 * Purpose:
 * Defines the BookmarkedProperty struct used by this package and its consumers.
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

/**
 * Purpose:
 * Defines the Watchlist struct used by this package and its consumers.
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

/**
 * Purpose:
 * Defines the AlertRule struct used by this package and its consumers.
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

/**
 * Purpose:
 * Defines the Notification struct used by this package and its consumers.
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
