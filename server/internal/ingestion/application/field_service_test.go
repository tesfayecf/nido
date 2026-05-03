package application

import (
	"context"
	"database/sql"
	"testing"
	"time"

	ingestiondomain "nido/server/internal/ingestion/domain"
)

type fieldServiceStoreStub struct {
	createdField   ingestiondomain.FieldDefinition
	fieldByID      ingestiondomain.FieldDefinition
	fieldByName    ingestiondomain.FieldDefinition
	latestConfig   ingestiondomain.PropertyExtractionConfig
	property       ingestiondomain.Property
	source         ingestiondomain.Source
	remapCalls     []struct{ propertyID, selectorName, fieldName string }
	createdConfigs []ingestiondomain.PropertyExtractionConfig
}

func (s *fieldServiceStoreStub) ListFieldDefinitions(context.Context) ([]ingestiondomain.FieldDefinitionUsage, error) {
	return nil, nil
}

func (s *fieldServiceStoreStub) GetFieldDefinition(context.Context, string) (ingestiondomain.FieldDefinition, error) {
	if s.fieldByID.ID == "" {
		return ingestiondomain.FieldDefinition{}, sql.ErrNoRows
	}
	return s.fieldByID, nil
}

func (s *fieldServiceStoreStub) GetFieldDefinitionByName(_ context.Context, fieldName string) (ingestiondomain.FieldDefinition, error) {
	if s.fieldByName.Name == "" || s.fieldByName.Name != fieldName {
		return ingestiondomain.FieldDefinition{}, sql.ErrNoRows
	}
	return s.fieldByName, nil
}

func (s *fieldServiceStoreStub) CreateFieldDefinition(_ context.Context, field ingestiondomain.FieldDefinition) error {
	s.createdField = field
	return nil
}

func (s *fieldServiceStoreStub) UpdateFieldDefinition(context.Context, ingestiondomain.FieldDefinition) error {
	return nil
}

func (s *fieldServiceStoreStub) DeleteFieldDefinition(context.Context, string) error { return nil }

func (s *fieldServiceStoreStub) ListAnalyticsRecords(context.Context) ([]ingestiondomain.AnalyticsPropertyRecord, error) {
	return nil, nil
}

func (s *fieldServiceStoreStub) RemapPropertyFieldValues(_ context.Context, propertyID, selectorName, fieldName string) error {
	s.remapCalls = append(s.remapCalls, struct{ propertyID, selectorName, fieldName string }{propertyID: propertyID, selectorName: selectorName, fieldName: fieldName})
	return nil
}

func (s *fieldServiceStoreStub) GetLatestPropertyConfig(context.Context, string) (ingestiondomain.PropertyExtractionConfig, error) {
	return s.latestConfig, nil
}

func (s *fieldServiceStoreStub) GetProperty(context.Context, string) (ingestiondomain.Property, error) {
	return s.property, nil
}

func (s *fieldServiceStoreStub) GetSource(context.Context, string) (ingestiondomain.Source, error) {
	if s.source.ID == "" {
		return ingestiondomain.Source{}, sql.ErrNoRows
	}
	return s.source, nil
}

func (s *fieldServiceStoreStub) CreatePropertyConfigVersion(_ context.Context, config ingestiondomain.PropertyExtractionConfig) error {
	s.createdConfigs = append(s.createdConfigs, config)
	return nil
}

func TestFieldServiceCreateFieldDefinition(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.April, 24, 12, 0, 0, 0, time.UTC)
	store := &fieldServiceStoreStub{}
	service := NewFieldService(nil, store, fixedClock{now: now})

	created, err := service.CreateFieldDefinition(context.Background(), ingestiondomain.FieldDefinition{
		DataType:    ingestiondomain.FieldDataTypeEnum,
		DisplayName: "Heating type",
		EnumValues:  []string{"Gas", "Electric"},
		Name:        "heating_type",
	})
	if err != nil {
		t.Fatalf("create field definition: %v", err)
	}
	if created.ID == "" {
		t.Fatal("expected generated field id")
	}
	if store.createdField.Name != "heating_type" {
		t.Fatalf("expected stored field name, got %q", store.createdField.Name)
	}
	if !store.createdField.CreatedAt.Equal(now) || !store.createdField.UpdatedAt.Equal(now) {
		t.Fatalf("expected normalized timestamps, got created=%s updated=%s", store.createdField.CreatedAt, store.createdField.UpdatedAt)
	}
}
