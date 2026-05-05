/**
 * File: internal/ingestion/domain/field_validation.go
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
)

const (
	FieldValidationStatusInvalid  = "invalid"
	FieldValidationStatusUnmapped = "unmapped"
	FieldValidationStatusValid    = "valid"
)

/**
 * Purpose:
 * Performs the ValidateFieldValue operation for this backend package.
 *
 * Parameters:
 * - definition FieldDefinition, raw string
 *
 * Returns:
 * - (string, string)
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
func ValidateFieldValue(definition FieldDefinition, raw string) (string, string) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return FieldValidationStatusInvalid, "value is empty"
	}

	switch definition.DataType {
	case FieldDataTypeString:
		return FieldValidationStatusValid, ""
	case FieldDataTypeNumber:
		if _, ok := parseFieldNumber(trimmed); ok {
			return FieldValidationStatusValid, ""
		}
		return FieldValidationStatusInvalid, "value is not a number"
	case FieldDataTypeBoolean:
		switch strings.ToLower(trimmed) {
		case "true", "false", "yes", "no", "1", "0":
			return FieldValidationStatusValid, ""
		default:
			return FieldValidationStatusInvalid, "value is not a boolean"
		}
	case FieldDataTypeEnum:
		for _, item := range definition.EnumValues {
			if strings.EqualFold(strings.TrimSpace(item), trimmed) {
				return FieldValidationStatusValid, ""
			}
		}
		return FieldValidationStatusInvalid, "value is not in the allowed set"
	default:
		return FieldValidationStatusInvalid, "field type is unsupported"
	}
}

/**
 * Purpose:
 * Performs the parseFieldNumber operation for this backend package.
 *
 * Parameters:
 * - raw string
 *
 * Returns:
 * - (float64, bool)
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
func parseFieldNumber(raw string) (float64, bool) {
	candidate := strings.ReplaceAll(raw, " ", "")
	candidate = strings.ReplaceAll(candidate, "€", "")
	candidate = strings.ReplaceAll(candidate, "m²", "")
	candidate = strings.ReplaceAll(candidate, "sqm", "")
	candidate = strings.ReplaceAll(candidate, ",", ".")
	candidate = strings.Map(func(r rune) rune {
		switch {
		case r >= '0' && r <= '9':
			return r
		case r == '.' || r == '-':
			return r
		default:
			return -1
		}
	}, candidate)
	if candidate == "" || candidate == "-" || candidate == "." {
		return 0, false
	}
	value, err := strconv.ParseFloat(candidate, 64)
	if err != nil {
		return 0, false
	}
	return value, true
}
