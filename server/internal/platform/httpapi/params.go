package httpapi

import (
	"strconv"
	"strings"
)

// ParseLimit converts a limit query parameter into an integer.
func ParseLimit(raw string) int {
	if strings.TrimSpace(raw) == "" {
		return 0
	}

	limit, err := strconv.Atoi(raw)
	if err != nil {
		return 0
	}

	return limit
}
