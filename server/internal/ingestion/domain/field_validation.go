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

// ValidateFieldValue validates a captured value against the field definition.
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
