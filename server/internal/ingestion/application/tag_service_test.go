package application

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	ingestiondomain "home-searcher/server/internal/ingestion/domain"
)

type tagStoreStub struct {
	tags                     []ingestiondomain.Tag
	propertyTags             map[string][]string // property ID -> tag IDs
	createTagFn              func(context.Context, ingestiondomain.Tag) error
	getTagByNameFn           func(context.Context, string) (ingestiondomain.Tag, error)
	assignTagsFn             func(context.Context, string, []string) error
	listPropertiesByTagIDsFn func(context.Context, []string, bool) ([]string, error)
}

func (s *tagStoreStub) CreateTag(ctx context.Context, tag ingestiondomain.Tag) error {
	if s.createTagFn != nil {
		return s.createTagFn(ctx, tag)
	}
	s.tags = append(s.tags, tag)
	return nil
}

func (s *tagStoreStub) GetTagByName(ctx context.Context, name string) (ingestiondomain.Tag, error) {
	if s.getTagByNameFn != nil {
		return s.getTagByNameFn(ctx, name)
	}
	for _, tag := range s.tags {
		if strings.EqualFold(tag.Name, name) {
			return tag, nil
		}
	}
	return ingestiondomain.Tag{}, sql.ErrNoRows
}

func (s *tagStoreStub) GetTag(ctx context.Context, tagID string) (ingestiondomain.Tag, error) {
	for _, tag := range s.tags {
		if tag.ID == tagID {
			return tag, nil
		}
	}
	return ingestiondomain.Tag{}, sql.ErrNoRows
}

func (s *tagStoreStub) ListTags(context.Context) ([]ingestiondomain.Tag, error) {
	return s.tags, nil
}

func (s *tagStoreStub) DeleteTag(ctx context.Context, tagID string) error {
	for i, tag := range s.tags {
		if tag.ID == tagID {
			s.tags = append(s.tags[:i], s.tags[i+1:]...)
			return nil
		}
	}
	return sql.ErrNoRows
}

func (s *tagStoreStub) AssignTags(ctx context.Context, propertyID string, tagIDs []string) error {
	if s.assignTagsFn != nil {
		return s.assignTagsFn(ctx, propertyID, tagIDs)
	}
	if s.propertyTags == nil {
		s.propertyTags = make(map[string][]string)
	}
	s.propertyTags[propertyID] = tagIDs
	return nil
}

func (s *tagStoreStub) AddPropertyTag(ctx context.Context, propertyID, tagID string) error {
	if s.propertyTags == nil {
		s.propertyTags = make(map[string][]string)
	}
	s.propertyTags[propertyID] = append(s.propertyTags[propertyID], tagID)
	return nil
}

func (s *tagStoreStub) RemovePropertyTag(ctx context.Context, propertyID, tagID string) error {
	if s.propertyTags == nil {
		return nil
	}
	tags := s.propertyTags[propertyID]
	for i, tid := range tags {
		if tid == tagID {
			s.propertyTags[propertyID] = append(tags[:i], tags[i+1:]...)
			break
		}
	}
	return nil
}

func (s *tagStoreStub) ListPropertyTags(ctx context.Context, propertyID string) ([]ingestiondomain.Tag, error) {
	if s.propertyTags == nil {
		return []ingestiondomain.Tag{}, nil
	}
	tagIDs := s.propertyTags[propertyID]
	result := make([]ingestiondomain.Tag, 0, len(tagIDs))
	for _, tagID := range tagIDs {
		for _, tag := range s.tags {
			if tag.ID == tagID {
				result = append(result, tag)
				break
			}
		}
	}
	return result, nil
}

func (s *tagStoreStub) ListPropertiesByTagIDs(ctx context.Context, tagIDs []string, matchAll bool) ([]string, error) {
	if s.listPropertiesByTagIDsFn != nil {
		return s.listPropertiesByTagIDsFn(ctx, tagIDs, matchAll)
	}
	return []string{}, nil
}

func TestTagServiceCreateTag(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	store := &tagStoreStub{}
	service := NewTagService(nil, store, nil, nil)

	tag, err := service.CreateTag(ctx, "urgent", "#FF0000")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if tag.Name != "urgent" {
		t.Errorf("expected tag name 'urgent', got %q", tag.Name)
	}
	if tag.Color != "#FF0000" {
		t.Errorf("expected color '#FF0000', got %q", tag.Color)
	}
	if len(store.tags) != 1 {
		t.Errorf("expected 1 tag in store, got %d", len(store.tags))
	}
}

func TestTagServiceCreateTagNormalizesName(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	store := &tagStoreStub{}
	service := NewTagService(nil, store, nil, nil)

	tag, err := service.CreateTag(ctx, "  High Priority  ", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if tag.Name != "High Priority" {
		t.Errorf("expected normalized name 'High Priority', got %q", tag.Name)
	}
}

func TestTagServiceCreateTagReturnsDuplicateIfExists(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	existing := ingestiondomain.Tag{ID: "tag_1", Name: "urgent", Color: "#FF0000"}
	store := &tagStoreStub{
		tags: []ingestiondomain.Tag{existing},
	}
	service := NewTagService(nil, store, nil, nil)

	tag, err := service.CreateTag(ctx, "URGENT", "#00FF00")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if tag.ID != "tag_1" {
		t.Errorf("expected existing tag ID 'tag_1', got %q", tag.ID)
	}
	if len(store.tags) != 1 {
		t.Errorf("expected 1 tag in store, got %d", len(store.tags))
	}
}

func TestTagServiceAssignTags(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	store := &tagStoreStub{
		tags: []ingestiondomain.Tag{
			{ID: "tag_1", Name: "urgent"},
			{ID: "tag_2", Name: "important"},
		},
	}
	service := NewTagService(nil, store, nil, nil)

	err := service.AssignTags(ctx, "prop_1", []string{"tag_1", "tag_2"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	tags := store.propertyTags["prop_1"]
	if len(tags) != 2 {
		t.Errorf("expected 2 tags assigned, got %d", len(tags))
	}
}

func TestTagServiceDeleteTag(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	store := &tagStoreStub{
		tags: []ingestiondomain.Tag{
			{ID: "tag_1", Name: "urgent"},
		},
	}
	service := NewTagService(nil, store, nil, nil)

	err := service.DeleteTag(ctx, "tag_1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(store.tags) != 0 {
		t.Errorf("expected 0 tags in store, got %d", len(store.tags))
	}
}

func TestTagServiceDeleteTagReturnsErrorIfNotFound(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	store := &tagStoreStub{}
	service := NewTagService(nil, store, nil, nil)

	err := service.DeleteTag(ctx, "tag_nonexistent")
	if err != ErrTagNotFound {
		t.Errorf("expected ErrTagNotFound, got %v", err)
	}
}
