/**
 * File: internal/ingestion/application/tag_service_test.go
 *
 * Purpose:
 * Validates the application package behavior covered by tag_service_test.go.
 *
 * Responsibilities:
 * - Set up deterministic test fixtures
 * - Exercise expected success and failure paths
 * - Protect backend behavior from regressions
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
 * - strings
 * - testing
 * - nido/server/internal/ingestion/domain
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
	"strings"
	"testing"

	ingestiondomain "nido/server/internal/ingestion/domain"
)

/**
 * Purpose:
 * Defines the tagStoreStub struct used by this package and its consumers.
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
type tagStoreStub struct {
	tags                     []ingestiondomain.Tag
	propertyTags             map[string][]string // property ID -> tag IDs
	createTagFn              func(context.Context, ingestiondomain.Tag) error
	getTagByNameFn           func(context.Context, string) (ingestiondomain.Tag, error)
	assignTagsFn             func(context.Context, string, []string) error
	listPropertiesByTagIDsFn func(context.Context, []string, bool) ([]string, error)
}

/**
 * Purpose:
 * Performs the CreateTag operation for this backend package.
 *
 * Parameters:
 * - s *tagStoreStub
 *
 * Returns:
 * - CreateTag(ctx context.Context, tag ingestiondomain.Tag) error
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
func (s *tagStoreStub) CreateTag(ctx context.Context, tag ingestiondomain.Tag) error {
	if s.createTagFn != nil {
		return s.createTagFn(ctx, tag)
	}
	s.tags = append(s.tags, tag)
	return nil
}

/**
 * Purpose:
 * Performs the GetTagByName operation for this backend package.
 *
 * Parameters:
 * - s *tagStoreStub
 *
 * Returns:
 * - GetTagByName(ctx context.Context, name string) (ingestiondomain.Tag, error)
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

/**
 * Purpose:
 * Performs the GetTag operation for this backend package.
 *
 * Parameters:
 * - s *tagStoreStub
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
func (s *tagStoreStub) GetTag(ctx context.Context, tagID string) (ingestiondomain.Tag, error) {
	for _, tag := range s.tags {
		if tag.ID == tagID {
			return tag, nil
		}
	}
	return ingestiondomain.Tag{}, sql.ErrNoRows
}

/**
 * Purpose:
 * Performs the ListTags operation for this backend package.
 *
 * Parameters:
 * - s *tagStoreStub
 *
 * Returns:
 * - ListTags(context.Context) ([]ingestiondomain.Tag, error)
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
func (s *tagStoreStub) ListTags(context.Context) ([]ingestiondomain.Tag, error) {
	return s.tags, nil
}

/**
 * Purpose:
 * Performs the DeleteTag operation for this backend package.
 *
 * Parameters:
 * - s *tagStoreStub
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
func (s *tagStoreStub) DeleteTag(ctx context.Context, tagID string) error {
	for i, tag := range s.tags {
		if tag.ID == tagID {
			s.tags = append(s.tags[:i], s.tags[i+1:]...)
			return nil
		}
	}
	return sql.ErrNoRows
}

/**
 * Purpose:
 * Performs the AssignTags operation for this backend package.
 *
 * Parameters:
 * - s *tagStoreStub
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

/**
 * Purpose:
 * Performs the AddPropertyTag operation for this backend package.
 *
 * Parameters:
 * - s *tagStoreStub
 *
 * Returns:
 * - AddPropertyTag(ctx context.Context, propertyID, tagID string) error
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
func (s *tagStoreStub) AddPropertyTag(ctx context.Context, propertyID, tagID string) error {
	if s.propertyTags == nil {
		s.propertyTags = make(map[string][]string)
	}
	s.propertyTags[propertyID] = append(s.propertyTags[propertyID], tagID)
	return nil
}

/**
 * Purpose:
 * Performs the RemovePropertyTag operation for this backend package.
 *
 * Parameters:
 * - s *tagStoreStub
 *
 * Returns:
 * - RemovePropertyTag(ctx context.Context, propertyID, tagID string) error
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

/**
 * Purpose:
 * Performs the ListPropertyTags operation for this backend package.
 *
 * Parameters:
 * - s *tagStoreStub
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

/**
 * Purpose:
 * Performs the ListPropertiesByTagIDs operation for this backend package.
 *
 * Parameters:
 * - s *tagStoreStub
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
func (s *tagStoreStub) ListPropertiesByTagIDs(ctx context.Context, tagIDs []string, matchAll bool) ([]string, error) {
	if s.listPropertiesByTagIDsFn != nil {
		return s.listPropertiesByTagIDsFn(ctx, tagIDs, matchAll)
	}
	return []string{}, nil
}

/**
 * Purpose:
 * Performs the TestTagServiceCreateTag operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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

/**
 * Purpose:
 * Performs the TestTagServiceCreateTagNormalizesName operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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

/**
 * Purpose:
 * Performs the TestTagServiceCreateTagReturnsDuplicateIfExists operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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

/**
 * Purpose:
 * Performs the TestTagServiceAssignTags operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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

/**
 * Purpose:
 * Performs the TestTagServiceDeleteTag operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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

/**
 * Purpose:
 * Performs the TestTagServiceDeleteTagReturnsErrorIfNotFound operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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
