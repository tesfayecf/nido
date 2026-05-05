/**
 * File: internal/ingestion/domain/property.go
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
	"encoding/json"
	"strings"
	"time"
)

/**
 * Purpose:
 * Defines the PropertyStatus type alias or composite type used by this package and its consumers.
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
type PropertyStatus string

const (
	// PropertyStatusPending means the property has not yet been ingested.
	PropertyStatusPending PropertyStatus = "pending"
	// PropertyStatusActive means the last ingest succeeded for the property.
	PropertyStatusActive PropertyStatus = "active"
	// PropertyStatusDegraded means the last ingest ran but required fields were missing.
	PropertyStatusDegraded PropertyStatus = "degraded"
	// PropertyStatusInactive means the property is no longer being tracked.
	PropertyStatusInactive PropertyStatus = "inactive"
)

/**
 * Purpose:
 * Defines the SelectorType type alias or composite type used by this package and its consumers.
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
type SelectorType string

const (
	SelectorTypeCSS       SelectorType = "css"
	SelectorTypeXPath     SelectorType = "xpath"
	SelectorTypeAttribute SelectorType = "attribute"
	SelectorTypeText      SelectorType = "text"
)

/**
 * Purpose:
 * Defines the ExtractionMode type alias or composite type used by this package and its consumers.
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
type ExtractionMode string

const (
	ExtractionModeText      ExtractionMode = "text"
	ExtractionModeAttribute ExtractionMode = "attribute"
)

/**
 * Purpose:
 * Defines the TextMode type alias or composite type used by this package and its consumers.
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
type TextMode string

const (
	TextModeTextContent TextMode = "textContent"
	TextModeInnerText   TextMode = "innerText"
)

/**
 * Purpose:
 * Defines the FieldRole type alias or composite type used by this package and its consumers.
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
type FieldRole string

const (
	// FieldRolePrefill imports mostly stable listing facts for faster property creation.
	FieldRolePrefill FieldRole = "prefill"
	// FieldRoleTracked compares values across runs as ongoing monitoring signals.
	FieldRoleTracked FieldRole = "tracked"
)

/**
 * Purpose:
 * Defines the FieldSelector struct used by this package and its consumers.
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
type FieldSelector struct {
	Name                  string         `json:"name"`
	FieldName             string         `json:"field_name,omitempty"`
	SelectorType          SelectorType   `json:"selector_type"`
	SelectorValue         string         `json:"selector_value"`
	FallbackSelectors     []string       `json:"fallback_selectors,omitempty"`
	ExtractionMode        ExtractionMode `json:"extraction_mode"`
	TextMode              TextMode       `json:"text_mode,omitempty"`
	Attribute             string         `json:"attribute,omitempty"`
	Transform             string         `json:"transform,omitempty"`
	DefaultValue          string         `json:"default_value,omitempty"`
	UseDefaultWhenMissing bool           `json:"use_default_when_missing,omitempty"`
	RegexPattern          string         `json:"regex_pattern,omitempty"`
	SplitDelimiter        string         `json:"split_delimiter,omitempty"`
	MultiValue            bool           `json:"multi_value,omitempty"`
	PartialMatch          string         `json:"partial_match,omitempty"`
	ComparisonOperator    string         `json:"comparison_operator,omitempty"`
	ComparisonValue       string         `json:"comparison_value,omitempty"`
	FieldRole             FieldRole      `json:"field_role,omitempty"`
	PropertyOverride      bool           `json:"property_override,omitempty"`
	Required              bool           `json:"required"`
	TemplateFieldName     string         `json:"template_field_name,omitempty"`
	TemplateSignature     string         `json:"template_signature,omitempty"`
}

/**
 * Purpose:
 * Defines the fieldSelectorPayload struct used by this package and its consumers.
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
type fieldSelectorPayload struct {
	Name                  string         `json:"name"`
	FieldName             string         `json:"field_name,omitempty"`
	SelectorType          SelectorType   `json:"selector_type"`
	SelectorValue         string         `json:"selector_value"`
	FallbackSelectors     []string       `json:"fallback_selectors,omitempty"`
	ExtractionMode        ExtractionMode `json:"extraction_mode"`
	TextMode              TextMode       `json:"text_mode,omitempty"`
	Attribute             string         `json:"attribute,omitempty"`
	Transform             string         `json:"transform,omitempty"`
	DefaultValue          string         `json:"default_value,omitempty"`
	UseDefaultWhenMissing bool           `json:"use_default_when_missing,omitempty"`
	RegexPattern          string         `json:"regex_pattern,omitempty"`
	SplitDelimiter        string         `json:"split_delimiter,omitempty"`
	MultiValue            bool           `json:"multi_value,omitempty"`
	PartialMatch          string         `json:"partial_match,omitempty"`
	ComparisonOperator    string         `json:"comparison_operator,omitempty"`
	ComparisonValue       string         `json:"comparison_value,omitempty"`
	FieldRole             FieldRole      `json:"field_role,omitempty"`
	PropertyOverride      bool           `json:"property_override,omitempty"`
	Required              bool           `json:"required"`
	Selectors             []string       `json:"selectors,omitempty"`
	TemplateFieldName     string         `json:"template_field_name,omitempty"`
	TemplateSignature     string         `json:"template_signature,omitempty"`
}

/**
 * Purpose:
 * Performs the UnmarshalJSON operation for this backend package.
 *
 * Parameters:
 * - field *FieldSelector
 *
 * Returns:
 * - UnmarshalJSON(data []byte) error
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
func (field *FieldSelector) UnmarshalJSON(data []byte) error {
	var payload fieldSelectorPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return err
	}

	normalized := FieldSelector{
		Attribute:             strings.TrimSpace(payload.Attribute),
		ComparisonOperator:    strings.TrimSpace(payload.ComparisonOperator),
		ComparisonValue:       strings.TrimSpace(payload.ComparisonValue),
		DefaultValue:          strings.TrimSpace(payload.DefaultValue),
		ExtractionMode:        payload.ExtractionMode,
		FieldRole:             NormalizeFieldRole(payload.FieldRole, payload.Name),
		FieldName:             strings.TrimSpace(payload.FieldName),
		MultiValue:            payload.MultiValue,
		Name:                  strings.TrimSpace(payload.Name),
		PartialMatch:          strings.TrimSpace(payload.PartialMatch),
		PropertyOverride:      payload.PropertyOverride,
		RegexPattern:          strings.TrimSpace(payload.RegexPattern),
		Required:              payload.Required,
		SelectorType:          payload.SelectorType,
		SelectorValue:         strings.TrimSpace(payload.SelectorValue),
		SplitDelimiter:        strings.TrimSpace(payload.SplitDelimiter),
		TextMode:              payload.TextMode,
		TemplateFieldName:     strings.TrimSpace(payload.TemplateFieldName),
		TemplateSignature:     strings.TrimSpace(payload.TemplateSignature),
		Transform:             strings.TrimSpace(payload.Transform),
		UseDefaultWhenMissing: payload.UseDefaultWhenMissing,
	}

	if normalized.SelectorValue == "" && len(payload.Selectors) > 0 {
		normalized.SelectorValue = strings.TrimSpace(payload.Selectors[0])
	}

	if len(payload.FallbackSelectors) > 0 {
		normalized.FallbackSelectors = NormalizeSelectorList(payload.FallbackSelectors)
	} else if len(payload.Selectors) > 1 {
		normalized.FallbackSelectors = NormalizeSelectorList(payload.Selectors[1:])
	}

	if normalized.SelectorType == "" {
		switch {
		case payload.SelectorType != "":
			normalized.SelectorType = payload.SelectorType
		case normalized.ExtractionMode == ExtractionModeAttribute:
			normalized.SelectorType = SelectorTypeAttribute
		default:
			normalized.SelectorType = SelectorTypeCSS
		}
	}

	if normalized.ExtractionMode == "" {
		if normalized.SelectorType == SelectorTypeAttribute || normalized.Attribute != "" {
			normalized.ExtractionMode = ExtractionModeAttribute
		} else {
			normalized.ExtractionMode = ExtractionModeText
		}
	}

	if normalized.TextMode == "" && normalized.ExtractionMode == ExtractionModeText {
		normalized.TextMode = TextModeInnerText
	}

	*field = normalized
	return nil
}

/**
 * Purpose:
 * Performs the MarshalJSON operation for this backend package.
 *
 * Parameters:
 * - field FieldSelector
 *
 * Returns:
 * - MarshalJSON() ([]byte, error)
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
func (field FieldSelector) MarshalJSON() ([]byte, error) {
	payload := fieldSelectorPayload{
		Attribute:             strings.TrimSpace(field.Attribute),
		ComparisonOperator:    strings.TrimSpace(field.ComparisonOperator),
		ComparisonValue:       strings.TrimSpace(field.ComparisonValue),
		DefaultValue:          strings.TrimSpace(field.DefaultValue),
		ExtractionMode:        field.ExtractionMode,
		FieldRole:             NormalizeFieldRole(field.FieldRole, field.Name),
		FieldName:             strings.TrimSpace(field.FieldName),
		FallbackSelectors:     NormalizeSelectorList(field.FallbackSelectors),
		MultiValue:            field.MultiValue,
		Name:                  strings.TrimSpace(field.Name),
		PartialMatch:          strings.TrimSpace(field.PartialMatch),
		PropertyOverride:      field.PropertyOverride,
		RegexPattern:          strings.TrimSpace(field.RegexPattern),
		Required:              field.Required,
		SelectorType:          field.SelectorType,
		SelectorValue:         strings.TrimSpace(field.SelectorValue),
		SplitDelimiter:        strings.TrimSpace(field.SplitDelimiter),
		TextMode:              field.TextMode,
		TemplateFieldName:     strings.TrimSpace(field.TemplateFieldName),
		TemplateSignature:     strings.TrimSpace(field.TemplateSignature),
		Transform:             strings.TrimSpace(field.Transform),
		UseDefaultWhenMissing: field.UseDefaultWhenMissing,
	}

	if payload.SelectorType == "" {
		payload.SelectorType = SelectorTypeCSS
	}
	if payload.ExtractionMode == "" {
		if payload.Attribute != "" || payload.SelectorType == SelectorTypeAttribute {
			payload.ExtractionMode = ExtractionModeAttribute
		} else {
			payload.ExtractionMode = ExtractionModeText
		}
	}
	if payload.TextMode == "" && payload.ExtractionMode == ExtractionModeText {
		payload.TextMode = TextModeInnerText
	}

	return json.Marshal(payload)
}

/**
 * Purpose:
 * Performs the NormalizeFieldRole operation for this backend package.
 *
 * Parameters:
 * - role FieldRole, fieldName string
 *
 * Returns:
 * - FieldRole
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
func NormalizeFieldRole(role FieldRole, fieldName string) FieldRole {
	switch role {
	case FieldRolePrefill, FieldRoleTracked:
		return role
	default:
		if strings.EqualFold(strings.TrimSpace(fieldName), "price") {
			return FieldRoleTracked
		}
		return FieldRolePrefill
	}
}

/**
 * Purpose:
 * Performs the NormalizeSelectorList operation for this backend package.
 *
 * Parameters:
 * - selectors []string
 *
 * Returns:
 * - []string
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
func NormalizeSelectorList(selectors []string) []string {
	normalized := make([]string, 0, len(selectors))
	for _, selector := range selectors {
		trimmed := strings.TrimSpace(selector)
		if trimmed == "" {
			continue
		}
		normalized = append(normalized, trimmed)
	}
	if len(normalized) == 0 {
		return nil
	}
	return normalized
}

/**
 * Purpose:
 * Defines the PropertyExtractionConfig struct used by this package and its consumers.
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
type PropertyExtractionConfig struct {
	ID            string          `json:"id"`
	PropertyID    string          `json:"property_id"`
	Fields        []FieldSelector `json:"fields"`
	Version       int             `json:"version"`
	CreatedAt     time.Time       `json:"created_at"`
	ChangeSummary string          `json:"change_summary,omitempty"`
}

/**
 * Purpose:
 * Defines the PropertyReference struct used by this package and its consumers.
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
type PropertyReference struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

/**
 * Purpose:
 * Defines the PropertyAttachment struct used by this package and its consumers.
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
type PropertyAttachment struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

/**
 * Purpose:
 * Defines the PropertyMetadata struct used by this package and its consumers.
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
type PropertyMetadata struct {
	PriorityLevel      string               `json:"priority_level,omitempty"`
	BusinessStage      string               `json:"business_stage,omitempty"`
	TrackingMode       string               `json:"tracking_mode,omitempty"`
	TargetPrice        int64                `json:"target_price,omitempty"`
	ExpectedRent       int64                `json:"expected_rent,omitempty"`
	ExpectedYieldBps   int                  `json:"expected_yield_bps,omitempty"`
	AcquisitionNotes   string               `json:"acquisition_notes,omitempty"`
	DealThesis         string               `json:"deal_thesis,omitempty"`
	ExternalReferences []PropertyReference  `json:"external_references,omitempty"`
	Attachments        []PropertyAttachment `json:"attachments,omitempty"`
}

/**
 * Purpose:
 * Defines the Property struct used by this package and its consumers.
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
type Property struct {
	ID                      string            `json:"id"`
	URL                     string            `json:"url"`
	Label                   string            `json:"label"`
	SourceID                string            `json:"source_id,omitempty"`
	BrowserEnabled          bool              `json:"browser_enabled,omitempty"`
	RequestHeaders          map[string]string `json:"request_headers,omitempty"`
	Status                  PropertyStatus    `json:"status"`
	ScheduleIntervalSeconds int               `json:"schedule_interval_seconds,omitempty"`
	RetryMaxAttempts        int               `json:"retry_max_attempts,omitempty"`
	RetryBackoffMillis      int               `json:"retry_backoff_millis,omitempty"`
	Paused                  bool              `json:"paused,omitempty"`
	PauseReason             string            `json:"pause_reason,omitempty"`
	Metadata                PropertyMetadata  `json:"metadata,omitempty"`
	LastRunAt               *time.Time        `json:"last_run_at,omitempty"`
	NextRunAt               *time.Time        `json:"next_run_at,omitempty"`
	CreatedAt               time.Time         `json:"created_at"`
	UpdatedAt               time.Time         `json:"updated_at"`
}

/**
 * Purpose:
 * Performs the RetryAttempts operation for this backend package.
 *
 * Parameters:
 * - p Property
 *
 * Returns:
 * - RetryAttempts() int
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
func (p Property) RetryAttempts() int {
	if p.RetryMaxAttempts <= 0 {
		return 1
	}

	return p.RetryMaxAttempts
}

/**
 * Purpose:
 * Performs the RetryBackoff operation for this backend package.
 *
 * Parameters:
 * - p Property
 *
 * Returns:
 * - RetryBackoff() time.Duration
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
func (p Property) RetryBackoff() time.Duration {
	if p.RetryBackoffMillis <= 0 {
		return 500 * time.Millisecond
	}

	return time.Duration(p.RetryBackoffMillis) * time.Millisecond
}

/**
 * Purpose:
 * Performs the ScheduleInterval operation for this backend package.
 *
 * Parameters:
 * - p Property
 *
 * Returns:
 * - ScheduleInterval() time.Duration
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
func (p Property) ScheduleInterval() time.Duration {
	if p.ScheduleIntervalSeconds <= 0 {
		return 0
	}

	return time.Duration(p.ScheduleIntervalSeconds) * time.Second
}

/**
 * Purpose:
 * Defines the PropertySnapshot struct used by this package and its consumers.
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
type PropertySnapshot struct {
	ID            string          `json:"id"`
	PropertyID    string          `json:"property_id"`
	ConfigVersion int             `json:"config_version"`
	ObservedAt    time.Time       `json:"observed_at"`
	Values        json.RawMessage `json:"values"`
	ChangeFlags   json.RawMessage `json:"change_flags,omitempty"`
	IsValid       bool            `json:"is_valid"`
	ErrorMessage  string          `json:"error_message,omitempty"`
}

/**
 * Purpose:
 * Defines the PropertyPreviewRequest struct used by this package and its consumers.
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
type PropertyPreviewRequest struct {
	URL            string            `json:"url"`
	BrowserEnabled bool              `json:"browser_enabled,omitempty"`
	RequestHeaders map[string]string `json:"request_headers,omitempty"`
	Fields         []FieldSelector   `json:"fields"`
}

/**
 * Purpose:
 * Defines the PropertyPreviewResult struct used by this package and its consumers.
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
type PropertyPreviewResult struct {
	Values   map[string]string            `json:"values"`
	Fields   []PropertyPreviewFieldResult `json:"fields"`
	Failures []string                     `json:"failures,omitempty"`
	Success  bool                         `json:"success"`
}

/**
 * Purpose:
 * Defines the PreviewErrorCode type alias or composite type used by this package and its consumers.
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
type PreviewErrorCode string

const (
	// PreviewErrorCodeOK indicates the field was extracted successfully.
	PreviewErrorCodeOK PreviewErrorCode = "ok"
	// PreviewErrorCodeSelectorInvalid indicates the selector itself could not be parsed.
	PreviewErrorCodeSelectorInvalid PreviewErrorCode = "selector_invalid"
	// PreviewErrorCodeUnsupportedType indicates the selector_type is not supported.
	PreviewErrorCodeUnsupportedType PreviewErrorCode = "unsupported_type"
	// PreviewErrorCodeNoMatch indicates no element matched any of the selectors.
	PreviewErrorCodeNoMatch PreviewErrorCode = "no_match"
	// PreviewErrorCodeAttributeMissing indicates the matched element had no such attribute.
	PreviewErrorCodeAttributeMissing PreviewErrorCode = "attribute_missing"
	// PreviewErrorCodeEmptyValue indicates the matched element produced an empty string.
	PreviewErrorCodeEmptyValue PreviewErrorCode = "empty_value"
	// PreviewErrorCodeTransformFailed indicates the configured transform produced an empty value.
	PreviewErrorCodeTransformFailed PreviewErrorCode = "transform_failed"
)

/**
 * Purpose:
 * Defines the PropertyPreviewFieldResult struct used by this package and its consumers.
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
type PropertyPreviewFieldResult struct {
	Name            string           `json:"name"`
	SelectorType    SelectorType     `json:"selector_type"`
	SelectorValue   string           `json:"selector_value"`
	ExtractionMode  ExtractionMode   `json:"extraction_mode"`
	TextMode        TextMode         `json:"text_mode,omitempty"`
	MatchedSelector string           `json:"matched_selector,omitempty"`
	MatchCount      int              `json:"match_count"`
	UsedFallback    bool             `json:"used_fallback,omitempty"`
	Value           string           `json:"value,omitempty"`
	Success         bool             `json:"success"`
	Message         string           `json:"message,omitempty"`
	ErrorCode       PreviewErrorCode `json:"error_code,omitempty"`
}

/**
 * Purpose:
 * Defines the PropertyRunStatus type alias or composite type used by this package and its consumers.
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
type PropertyRunStatus string

const (
	// PropertyRunStatusPending means the run has been queued but not started.
	PropertyRunStatusPending PropertyRunStatus = "pending"
	// PropertyRunStatusRunning means the run is currently executing.
	PropertyRunStatusRunning PropertyRunStatus = "running"
	// PropertyRunStatusSuccess means the run completed successfully.
	PropertyRunStatusSuccess PropertyRunStatus = "success"
	// PropertyRunStatusFailed means the run failed.
	PropertyRunStatusFailed PropertyRunStatus = "failed"
)

/**
 * Purpose:
 * Defines the PropertyRun struct used by this package and its consumers.
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
type PropertyRun struct {
	ID           string            `json:"id"`
	PropertyID   string            `json:"property_id"`
	Status       PropertyRunStatus `json:"status"`
	TriggerKind  string            `json:"trigger_kind"`
	AttemptCount int               `json:"attempt_count"`
	MaxAttempts  int               `json:"max_attempts"`
	StartedAt    *time.Time        `json:"started_at,omitempty"`
	FinishedAt   *time.Time        `json:"finished_at,omitempty"`
	ErrorMessage string            `json:"error_message,omitempty"`
	SnapshotID   string            `json:"snapshot_id,omitempty"`
	CreatedAt    time.Time         `json:"created_at"`
}
