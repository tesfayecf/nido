/**
 * File: internal/ingestion/domain/intelligence.go
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
 * - time
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package domain

import "time"

/**
 * Purpose:
 * Defines the ChangeImpact type alias or composite type used by this package and its consumers.
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
type ChangeImpact string

const (
	// ChangeImpactPositive indicates the change is favourable for acquisition.
	ChangeImpactPositive ChangeImpact = "positive"
	// ChangeImpactNegative indicates the change is unfavourable for acquisition.
	ChangeImpactNegative ChangeImpact = "negative"
	// ChangeImpactNeutral indicates the change has no clear directional implication.
	ChangeImpactNeutral ChangeImpact = "neutral"
)

/**
 * Purpose:
 * Defines the ChangeGroup type alias or composite type used by this package and its consumers.
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
type ChangeGroup string

const (
	ChangeGroupPricing      ChangeGroup = "pricing"
	ChangeGroupStatus       ChangeGroup = "status"
	ChangeGroupDataQuality  ChangeGroup = "data_quality"
	ChangeGroupFreshness    ChangeGroup = "freshness"
	ChangeGroupListingFacts ChangeGroup = "listing_facts"
)

/**
 * Purpose:
 * Defines the ChangeSignal struct used by this package and its consumers.
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
type ChangeSignal struct {
	// Field is the logical name of the changed field, e.g. "price", "status".
	Field string `json:"field"`
	// Label is a human-readable description of the change.
	Label string `json:"label"`
	// Previous value as a string, empty if not applicable.
	Previous string `json:"previous,omitempty"`
	// Current value as a string.
	Current string `json:"current,omitempty"`
	// AbsoluteDelta is the numeric magnitude of the change (price/sqm only), nil if not applicable.
	AbsoluteDelta *int64 `json:"absolute_delta,omitempty"`
	// PercentDelta is the percentage change (price only), nil if not applicable.
	PercentDelta *float64 `json:"percent_delta,omitempty"`
	// ObservedAt is when this signal was detected.
	ObservedAt time.Time `json:"observed_at"`
	// Impact classifies whether the change is positive, negative, or neutral.
	Impact ChangeImpact `json:"impact"`
	// Group categorises the signal by domain area.
	Group ChangeGroup `json:"group"`
}

/**
 * Purpose:
 * Defines the DecisionContext struct used by this package and its consumers.
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
type DecisionContext struct {
	// CurrentPrice is the latest extracted listing price in the smallest currency unit, nil if unknown.
	CurrentPrice *int64 `json:"current_price,omitempty"`
	// TargetPrice is the operator-set target acquisition price, nil if not set.
	TargetPrice *int64 `json:"target_price,omitempty"`
	// PriceGapAbsolute is CurrentPrice - TargetPrice (positive means over budget), nil if either is unknown.
	PriceGapAbsolute *int64 `json:"price_gap_absolute,omitempty"`
	// PriceGapPercent is the percentage gap relative to target price, nil if either is unknown.
	PriceGapPercent *float64 `json:"price_gap_percent,omitempty"`
	// CurrentPricePerSqm is the derived €/m² from snapshot values, nil if unknown.
	CurrentPricePerSqm *int64 `json:"current_price_per_sqm,omitempty"`
	// ExpectedYieldBps is the operator-set expected yield in basis points, 0 if not set.
	ExpectedYieldBps int `json:"expected_yield_bps,omitempty"`
	// Stage is the operator-set business stage (e.g. "watchlist", "negotiation").
	Stage string `json:"stage,omitempty"`
	// PriorityLevel is the operator-set priority (e.g. "high", "medium", "low").
	PriorityLevel string `json:"priority_level,omitempty"`
	// DealThesisSummary is a truncated (≤160 chars) version of the deal thesis.
	DealThesisSummary string `json:"deal_thesis_summary,omitempty"`
	// FreshnessStatus is "fresh", "stale", or "unknown".
	FreshnessStatus string `json:"freshness_status"`
	// LastObservedAt is the timestamp of the latest snapshot, nil if no snapshot exists.
	LastObservedAt *time.Time `json:"last_observed_at,omitempty"`
}

/**
 * Purpose:
 * Defines the PropertySummary struct used by this package and its consumers.
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
type PropertySummary struct {
	Property            Property          `json:"property"`
	CurrentValues       map[string]string `json:"current_values"`
	Decision            DecisionContext   `json:"decision"`
	Signals             []ChangeSignal    `json:"signals"`
	LatestChangeSummary string            `json:"latest_change_summary,omitempty"`
}
