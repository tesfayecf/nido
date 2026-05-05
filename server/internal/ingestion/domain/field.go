/**
 * File: internal/ingestion/domain/field.go
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
 * - strconv
 * - strings
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
	"strconv"
	"strings"
	"time"
)

/**
 * Purpose:
 * Defines the FieldDataType type alias or composite type used by this package and its consumers.
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
type FieldDataType string

const (
	FieldDataTypeNumber  FieldDataType = "number"
	FieldDataTypeString  FieldDataType = "string"
	FieldDataTypeBoolean FieldDataType = "boolean"
	FieldDataTypeEnum    FieldDataType = "enum"
)

/**
 * Purpose:
 * Defines the FieldDefinition struct used by this package and its consumers.
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
type FieldDefinition struct {
	ID                    string        `json:"id"`
	Name                  string        `json:"name"`
	DisplayName           string        `json:"display_name"`
	DataType              FieldDataType `json:"data_type"`
	Unit                  string        `json:"unit,omitempty"`
	Description           string        `json:"description,omitempty"`
	EnumValues            []string      `json:"enum_values,omitempty"`
	DefaultValue          string        `json:"default_value,omitempty"`
	UseDefaultWhenMissing bool          `json:"use_default_when_missing,omitempty"`
	ComparisonOperator    string        `json:"comparison_operator,omitempty"`
	ComparisonValue       string        `json:"comparison_value,omitempty"`
	SystemDefined         bool          `json:"system_defined"`
	CreatedAt             time.Time     `json:"created_at"`
	UpdatedAt             time.Time     `json:"updated_at"`
}

/**
 * Purpose:
 * Defines the FieldDefinitionUsage struct used by this package and its consumers.
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
type FieldDefinitionUsage struct {
	FieldDefinition
	PropertiesUsing int `json:"properties_using"`
	ValueCount      int `json:"value_count"`
	UnmappedCount   int `json:"unmapped_count,omitempty"`
}

/**
 * Purpose:
 * Defines the PropertyFieldValue struct used by this package and its consumers.
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
type PropertyFieldValue struct {
	ID                string    `json:"id"`
	PropertyID        string    `json:"property_id"`
	SnapshotID        string    `json:"snapshot_id"`
	FieldDefinitionID string    `json:"field_definition_id,omitempty"`
	FieldName         string    `json:"field_name,omitempty"`
	SelectorName      string    `json:"selector_name"`
	Value             string    `json:"value"`
	ObservedAt        time.Time `json:"observed_at"`
	ValidationStatus  string    `json:"validation_status"`
	ValidationMessage string    `json:"validation_message,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
}

/**
 * Purpose:
 * Defines the AnalyticsPropertyRecord struct used by this package and its consumers.
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
type AnalyticsPropertyRecord struct {
	PropertyID    string            `json:"property_id"`
	PropertyLabel string            `json:"property_label,omitempty"`
	PropertyURL   string            `json:"property_url"`
	SourceID      string            `json:"source_id,omitempty"`
	Status        string            `json:"status"`
	ObservedAt    time.Time         `json:"observed_at"`
	Values        map[string]string `json:"values"`
}

/**
 * Purpose:
 * Performs the ParseLooseFloat operation for this backend package.
 *
 * Parameters:
 * - value string
 *
 * Returns:
 * - float64
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
func ParseLooseFloat(value string) float64 {
	var builder strings.Builder
	for _, r := range value {
		if (r >= '0' && r <= '9') || r == '.' || r == ',' || r == '-' {
			builder.WriteRune(r)
		}
	}
	parsed, _ := strconv.ParseFloat(strings.ReplaceAll(builder.String(), ",", "."), 64)
	return parsed
}
