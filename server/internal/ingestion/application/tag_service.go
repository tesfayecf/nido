package application

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"strings"

	ingestiondomain "home-searcher/server/internal/ingestion/domain"
	"home-searcher/server/internal/platform/id"
)

// ErrTagNotFound indicates that the requested tag does not exist.
var ErrTagNotFound = errors.New("tag not found")

// ErrInvalidTagName indicates that the provided tag name is invalid.
var ErrInvalidTagName = errors.New("invalid tag name")

// TagStore defines the persistence contract required by TagService.
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

// TagService orchestrates tag creation and assignment to properties.
type TagService struct {
	logger *slog.Logger
	store  TagStore
	clock  Clock
	events Publisher
}

// NewTagService builds a TagService.
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

// CreateTag validates and creates a new tag, or returns existing if duplicate name.
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

// ListTags returns all tags.
func (s *TagService) ListTags(ctx context.Context) ([]ingestiondomain.Tag, error) {
	return s.store.ListTags(ctx)
}

// GetTag returns one tag by identifier.
func (s *TagService) GetTag(ctx context.Context, tagID string) (ingestiondomain.Tag, error) {
	tag, err := s.store.GetTag(ctx, tagID)
	if errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.Tag{}, ErrTagNotFound
	}
	return tag, err
}

// DeleteTag removes a tag and all its property associations.
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

// AssignTags replaces the full set of tags for a property (idempotent).
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

// AddTag adds a single tag to a property.
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

// RemoveTag removes a single tag from a property.
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

// ListPropertyTags returns all tags assigned to a property.
func (s *TagService) ListPropertyTags(ctx context.Context, propertyID string) ([]ingestiondomain.Tag, error) {
	return s.store.ListPropertyTags(ctx, propertyID)
}

// ListPropertiesByTagIDs returns property IDs that match the given tags.
func (s *TagService) ListPropertiesByTagIDs(ctx context.Context, tagIDs []string, matchAll bool) ([]string, error) {
	return s.store.ListPropertiesByTagIDs(ctx, tagIDs, matchAll)
}

func (s *TagService) emit(eventType string, data map[string]any) {
	if s.events != nil {
		s.events.Publish(eventType, data)
	}
}
