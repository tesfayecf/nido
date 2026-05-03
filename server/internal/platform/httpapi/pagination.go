package httpapi

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

const (
	DefaultPageSize = 50
	MaxPageSize     = 100
)

// Pagination describes the stable list-window contract returned by collection endpoints.
type Pagination struct {
	Mode        string `json:"mode"`
	Total       int    `json:"total"`
	Page        int    `json:"page,omitempty"`
	PageSize    int    `json:"pageSize,omitempty"`
	Limit       int    `json:"limit,omitempty"`
	Cursor      string `json:"cursor,omitempty"`
	NextCursor  string `json:"nextCursor,omitempty"`
	PrevCursor  string `json:"prevCursor,omitempty"`
	HasNext     bool   `json:"hasNext"`
	HasPrevious bool   `json:"hasPrevious"`
}

type paginationRequest struct {
	mode     string
	page     int
	pageSize int
	offset   int
	cursor   string
}

type cursorPayload struct {
	Offset int `json:"offset"`
}

// WritePaginatedJSON writes a backwards-compatible collection payload with data and pagination metadata.
func WritePaginatedJSON[T any](w http.ResponseWriter, r *http.Request, statusCode int, items []T, meta map[string]any) {
	request, err := parsePaginationRequest(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	pageItems, pagination := paginateItems(items, request)
	payload := map[string]any{
		"data":       pageItems,
		"items":      pageItems,
		"count":      len(pageItems),
		"pagination": pagination,
	}
	if len(meta) > 0 {
		payload["meta"] = meta
	}

	WriteCacheableJSON(w, r, statusCode, payload)
}

// WriteCacheableJSON writes JSON with deterministic ETag support for conditional GET requests.
func WriteCacheableJSON(w http.ResponseWriter, r *http.Request, statusCode int, payload any) {
	body, err := json.Marshal(payload)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to encode response")
		return
	}

	sum := sha256.Sum256(body)
	etag := `"` + hex.EncodeToString(sum[:]) + `"`
	w.Header().Set("Cache-Control", "private, max-age=30, must-revalidate")
	w.Header().Set("ETag", etag)
	w.Header().Set("Vary", "Accept-Encoding, Authorization")
	if r.Method == http.MethodGet && strings.TrimSpace(r.Header.Get("If-None-Match")) == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	_, _ = w.Write(append(body, '\n'))
}

func parsePaginationRequest(r *http.Request) (paginationRequest, error) {
	query := r.URL.Query()
	if strings.TrimSpace(query.Get("cursor")) != "" || strings.EqualFold(strings.TrimSpace(query.Get("mode")), "cursor") {
		limit, err := parseBoundedPositiveInt(query.Get("limit"), "limit", DefaultPageSize)
		if err != nil {
			return paginationRequest{}, err
		}
		cursor := query.Get("cursor")
		offset := 0
		if strings.TrimSpace(cursor) != "" {
			var err error
			offset, err = decodeCursor(cursor)
			if err != nil {
				return paginationRequest{}, err
			}
		}
		return paginationRequest{mode: "cursor", pageSize: limit, offset: offset, cursor: cursor}, nil
	}

	page, err := parseBoundedPositiveInt(query.Get("page"), "page", 1)
	if err != nil {
		return paginationRequest{}, err
	}
	rawPageSize := query.Get("pageSize")
	if rawPageSize == "" {
		rawPageSize = query.Get("page_size")
	}
	if rawPageSize == "" {
		rawPageSize = query.Get("limit")
	}
	pageSize, err := parseBoundedPositiveInt(rawPageSize, "pageSize", DefaultPageSize)
	if err != nil {
		return paginationRequest{}, err
	}

	return paginationRequest{
		mode:     "offset",
		page:     page,
		pageSize: pageSize,
		offset:   (page - 1) * pageSize,
	}, nil
}

func parseBoundedPositiveInt(raw string, name string, fallback int) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("invalid %s parameter", name)
	}
	if name != "page" && value > MaxPageSize {
		return 0, fmt.Errorf("%s must be less than or equal to %d", name, MaxPageSize)
	}
	return value, nil
}

func paginateItems[T any](items []T, request paginationRequest) ([]T, Pagination) {
	total := len(items)
	start := request.offset
	if start > total {
		start = total
	}
	end := start + request.pageSize
	if end > total {
		end = total
	}

	pagination := Pagination{
		Mode:        request.mode,
		Total:       total,
		HasNext:     end < total,
		HasPrevious: start > 0,
	}
	if request.mode == "cursor" {
		pagination.Limit = request.pageSize
		pagination.Cursor = request.cursor
		if pagination.HasNext {
			pagination.NextCursor = encodeCursor(end)
		}
		if pagination.HasPrevious {
			previous := start - request.pageSize
			if previous < 0 {
				previous = 0
			}
			pagination.PrevCursor = encodeCursor(previous)
		}
	} else {
		pagination.Page = request.page
		pagination.PageSize = request.pageSize
	}

	return items[start:end], pagination
}

func encodeCursor(offset int) string {
	encoded, _ := json.Marshal(cursorPayload{Offset: offset})
	return base64.RawURLEncoding.EncodeToString(encoded)
}

func decodeCursor(raw string) (int, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(raw))
	if err != nil {
		return 0, fmt.Errorf("invalid cursor parameter")
	}
	var payload cursorPayload
	if err := json.Unmarshal(decoded, &payload); err != nil || payload.Offset < 0 {
		return 0, fmt.Errorf("invalid cursor parameter")
	}
	return payload.Offset, nil
}
