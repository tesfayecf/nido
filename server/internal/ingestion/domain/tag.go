package domain

import (
	"strings"
	"time"
)

// Tag represents a label that can be applied to properties for organization and filtering.
type Tag struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// NormalizeTagName normalizes a tag name for consistent storage and comparison.
func NormalizeTagName(name string) string {
	return strings.TrimSpace(name)
}

// ValidateTagName checks if a tag name is valid.
func ValidateTagName(name string) bool {
	normalized := NormalizeTagName(name)
	return normalized != "" && len(normalized) <= 100
}
