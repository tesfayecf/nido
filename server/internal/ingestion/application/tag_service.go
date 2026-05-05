/**
 * File: internal/ingestion/application/tag_service.go
 *
 * Purpose:
 * Coordinates application-level backend use cases, validation, and persistence boundaries.
 *
 * Responsibilities:
 * - Apply business rules
 * - Coordinate repositories and domain models
 * - Return typed results for transport layers
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - context
 * - database/sql
 * - errors
 * - log/slog
 * - strings
 * - nido/server/internal/ingestion/domain
 * - nido/server/internal/platform/id
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package application

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"strings"

	ingestiondomain "nido/server/internal/ingestion/domain"
	"nido/server/internal/platform/id"
)

// ErrTagNotFound indicates that the requested tag does not exist.
var ErrTagNotFound = errors.New("tag not found")

// ErrInvalidTagName indicates that the provided tag name is invalid.
var ErrInvalidTagName = errors.New("invalid tag name")

/**
 * Purpose:
 * Defines the TagStore interface used by this package and its consumers.
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
type TagStore interface {
	CreateTag(ctx context.Context, tag ingestiondomain.Tag) error
	GetTagByName(ctx context.Context, name string) (ingestiondomain.Tag, error)
	GetTag(ctx context.Context, tagID string) (ingestiondomain.Tag, error)
	ListTags(ctx context.Context) ([]ingestiondomain.Tag, error)
	DeleteTag(ctx context.Context, tagID string) error
	AssignTags(ctx context.Context, propertyID string, tagIDs []string) error
	AddPropertyTag(ctx context.Context, propertyID, tagID string) error
	RemovePropertyTag(ctx context.Context, propertyID, tagID string) error
	ListPropertyTags(ctx context.Context, propertyID string) ([]ingestiondomain.Tag, error)
	ListPropertiesByTagIDs(ctx context.Context, tagIDs []string, matchAll bool) ([]string, error)
}

/**
 * Purpose:
 * Defines the TagService struct used by this package and its consumers.
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
type TagService struct {
	logger *slog.Logger
	store  TagStore
	clock  Clock
	events Publisher
}

/**
 * Purpose:
 * Performs the NewTagService operation for this backend package.
 *
 * Parameters:
 * - logger *slog.Logger, store TagStore, clock Clock, events Publisher
 *
 * Returns:
 * - *TagService
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func NewTagService(
	logger *slog.Logger,
	store TagStore,
	clock Clock,
	events Publisher,
) *TagService {
	resolvedClock := clock
	if resolvedClock == nil {
		resolvedClock = systemClock{}
	}

	return &TagService{
		logger: logger,
		store:  store,
		clock:  resolvedClock,
		events: events,
	}
}

/**
 * Purpose:
 * Performs the CreateTag operation for this backend package.
 *
 * Parameters:
 * - s *TagService
 *
 * Returns:
 * - CreateTag(ctx context.Context, name, color string) (ingestiondomain.Tag, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *TagService) CreateTag(ctx context.Context, name, color string) (ingestiondomain.Tag, error) {
	normalized := ingestiondomain.NormalizeTagName(name)
	if !ingestiondomain.ValidateTagName(normalized) {
		return ingestiondomain.Tag{}, ErrInvalidTagName
	}

	// Check if tag with this name already exists (case-insensitive)
	existing, err := s.store.GetTagByName(ctx, normalized)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.Tag{}, err
	}

	now := s.clock.Now().UTC()
	tag := ingestiondomain.Tag{
		ID:        id.New("tag"),
		Name:      normalized,
		Color:     strings.TrimSpace(color),
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.store.CreateTag(ctx, tag); err != nil {
		return ingestiondomain.Tag{}, err
	}

	s.emit("tag.created", map[string]any{
		"tag_id": tag.ID,
		"name":   tag.Name,
	})

	return tag, nil
}

/**
 * Purpose:
 * Performs the ListTags operation for this backend package.
 *
 * Parameters:
 * - s *TagService
 *
 * Returns:
 * - ListTags(ctx context.Context) ([]ingestiondomain.Tag, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *TagService) ListTags(ctx context.Context) ([]ingestiondomain.Tag, error) {
	return s.store.ListTags(ctx)
}

/**
 * Purpose:
 * Performs the GetTag operation for this backend package.
 *
 * Parameters:
 * - s *TagService
 *
 * Returns:
 * - GetTag(ctx context.Context, tagID string) (ingestiondomain.Tag, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *TagService) GetTag(ctx context.Context, tagID string) (ingestiondomain.Tag, error) {
	tag, err := s.store.GetTag(ctx, tagID)
	if errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.Tag{}, ErrTagNotFound
	}
	return tag, err
}

/**
 * Purpose:
 * Performs the DeleteTag operation for this backend package.
 *
 * Parameters:
 * - s *TagService
 *
 * Returns:
 * - DeleteTag(ctx context.Context, tagID string) error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *TagService) DeleteTag(ctx context.Context, tagID string) error {
	err := s.store.DeleteTag(ctx, tagID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrTagNotFound
	}

	if err == nil {
		s.emit("tag.deleted", map[string]any{"tag_id": tagID})
	}

	return err
}

/**
 * Purpose:
 * Performs the AssignTags operation for this backend package.
 *
 * Parameters:
 * - s *TagService
 *
 * Returns:
 * - AssignTags(ctx context.Context, propertyID string, tagIDs []string) error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *TagService) AssignTags(ctx context.Context, propertyID string, tagIDs []string) error {
	if err := s.store.AssignTags(ctx, propertyID, tagIDs); err != nil {
		return err
	}

	s.emit("tag.assigned", map[string]any{
		"property_id": propertyID,
		"tag_ids":     tagIDs,
	})

	return nil
}

/**
 * Purpose:
 * Performs the AddTag operation for this backend package.
 *
 * Parameters:
 * - s *TagService
 *
 * Returns:
 * - AddTag(ctx context.Context, propertyID, tagID string) error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *TagService) AddTag(ctx context.Context, propertyID, tagID string) error {
	if err := s.store.AddPropertyTag(ctx, propertyID, tagID); err != nil {
		return err
	}

	s.emit("tag.assigned", map[string]any{
		"property_id": propertyID,
		"tag_ids":     []string{tagID},
	})

	return nil
}

/**
 * Purpose:
 * Performs the RemoveTag operation for this backend package.
 *
 * Parameters:
 * - s *TagService
 *
 * Returns:
 * - RemoveTag(ctx context.Context, propertyID, tagID string) error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *TagService) RemoveTag(ctx context.Context, propertyID, tagID string) error {
	if err := s.store.RemovePropertyTag(ctx, propertyID, tagID); err != nil {
		return err
	}

	s.emit("tag.unassigned", map[string]any{
		"property_id": propertyID,
		"tag_id":      tagID,
	})

	return nil
}

/**
 * Purpose:
 * Performs the ListPropertyTags operation for this backend package.
 *
 * Parameters:
 * - s *TagService
 *
 * Returns:
 * - ListPropertyTags(ctx context.Context, propertyID string) ([]ingestiondomain.Tag, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *TagService) ListPropertyTags(ctx context.Context, propertyID string) ([]ingestiondomain.Tag, error) {
	return s.store.ListPropertyTags(ctx, propertyID)
}

/**
 * Purpose:
 * Performs the ListPropertiesByTagIDs operation for this backend package.
 *
 * Parameters:
 * - s *TagService
 *
 * Returns:
 * - ListPropertiesByTagIDs(ctx context.Context, tagIDs []string, matchAll bool) ([]string, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *TagService) ListPropertiesByTagIDs(ctx context.Context, tagIDs []string, matchAll bool) ([]string, error) {
	return s.store.ListPropertiesByTagIDs(ctx, tagIDs, matchAll)
}

/**
 * Purpose:
 * Performs the emit operation for this backend package.
 *
 * Parameters:
 * - s *TagService
 *
 * Returns:
 * - emit(eventType string, data map[string]any)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *TagService) emit(eventType string, data map[string]any) {
	if s.events != nil {
		s.events.Publish(eventType, data)
	}
}
