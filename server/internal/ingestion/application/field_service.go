package application

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	ingestiondomain "nido/server/internal/ingestion/domain"
	"nido/server/internal/platform/id"
)

// ErrFieldDefinitionNotFound indicates the requested field does not exist.
var ErrFieldDefinitionNotFound = errors.New("field definition not found")

type FieldStore interface {
	ListFieldDefinitions(ctx context.Context) ([]ingestiondomain.FieldDefinitionUsage, error)
	GetFieldDefinition(ctx context.Context, fieldID string) (ingestiondomain.FieldDefinition, error)
	CreateFieldDefinition(ctx context.Context, field ingestiondomain.FieldDefinition) error
	UpdateFieldDefinition(ctx context.Context, field ingestiondomain.FieldDefinition) error
	DeleteFieldDefinition(ctx context.Context, fieldID string) error
	ListAnalyticsRecords(ctx context.Context) ([]ingestiondomain.AnalyticsPropertyRecord, error)
}

// FieldService manages canonical field definitions and analytics records.
type FieldService struct {
	logger *slog.Logger
	store  FieldStore
	clock  Clock
}

func NewFieldService(logger *slog.Logger, store FieldStore, clock Clock) *FieldService {
	resolvedClock := clock
	if resolvedClock == nil {
		resolvedClock = systemClock{}
	}
	return &FieldService{logger: logger, store: store, clock: resolvedClock}
}

func (s *FieldService) ListFieldDefinitions(ctx context.Context) ([]ingestiondomain.FieldDefinitionUsage, error) {
	return s.store.ListFieldDefinitions(ctx)
}

func (s *FieldService) CreateFieldDefinition(ctx context.Context, field ingestiondomain.FieldDefinition) (ingestiondomain.FieldDefinition, error) {
	now := s.clock.Now().UTC()
	normalized, err := normalizeFieldDefinitionInput(field, now, false)
	if err != nil {
		return ingestiondomain.FieldDefinition{}, err
	}
	normalized.ID = id.New("field")
	if err := s.store.CreateFieldDefinition(ctx, normalized); err != nil {
		return ingestiondomain.FieldDefinition{}, err
	}
	return normalized, nil
}

func (s *FieldService) UpdateFieldDefinition(ctx context.Context, fieldID string, patch ingestiondomain.FieldDefinition) (ingestiondomain.FieldDefinition, error) {
	existing, err := s.store.GetFieldDefinition(ctx, fieldID)
	if errors.Is(err, sql.ErrNoRows) {
		return ingestiondomain.FieldDefinition{}, ErrFieldDefinitionNotFound
	}
	if err != nil {
		return ingestiondomain.FieldDefinition{}, err
	}
	if strings.TrimSpace(patch.Name) != "" && !strings.EqualFold(strings.TrimSpace(patch.Name), existing.Name) {
		return ingestiondomain.FieldDefinition{}, fmt.Errorf("field name cannot be changed")
	}

	now := s.clock.Now().UTC()
	next, err := normalizeFieldDefinitionInput(ingestiondomain.FieldDefinition{
		ID:                    existing.ID,
		Name:                  existing.Name,
		DisplayName:           firstNonEmptyString(patch.DisplayName, existing.DisplayName),
		DataType:              firstNonEmptyFieldType(patch.DataType, existing.DataType),
		Unit:                  firstNonEmptyString(patch.Unit, existing.Unit),
		Description:           firstNonEmptyString(patch.Description, existing.Description),
		EnumValues:            chooseStringSlice(patch.EnumValues, existing.EnumValues),
		DefaultValue:          chooseStringValue(patch.DefaultValue, existing.DefaultValue),
		UseDefaultWhenMissing: patch.UseDefaultWhenMissing,
		ComparisonOperator:    chooseStringValue(patch.ComparisonOperator, existing.ComparisonOperator),
		ComparisonValue:       chooseStringValue(patch.ComparisonValue, existing.ComparisonValue),
		SystemDefined:         existing.SystemDefined,
		CreatedAt:             existing.CreatedAt,
	}, now, true)
	if err != nil {
		return ingestiondomain.FieldDefinition{}, err
	}
	if err := s.store.UpdateFieldDefinition(ctx, next); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ingestiondomain.FieldDefinition{}, ErrFieldDefinitionNotFound
		}
		return ingestiondomain.FieldDefinition{}, err
	}
	return next, nil
}

func (s *FieldService) DeleteFieldDefinition(ctx context.Context, fieldID string) error {
	err := s.store.DeleteFieldDefinition(ctx, fieldID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrFieldDefinitionNotFound
	}
	return err
}

func (s *FieldService) ListAnalyticsRecords(ctx context.Context) ([]ingestiondomain.AnalyticsPropertyRecord, error) {
	return s.store.ListAnalyticsRecords(ctx)
}

func normalizeFieldDefinitionInput(field ingestiondomain.FieldDefinition, now time.Time, keepID bool) (ingestiondomain.FieldDefinition, error) {
	field.Name = strings.TrimSpace(strings.ToLower(field.Name))
	field.DisplayName = strings.TrimSpace(field.DisplayName)
	field.Unit = strings.TrimSpace(field.Unit)
	field.Description = strings.TrimSpace(field.Description)
	field.DefaultValue = strings.TrimSpace(field.DefaultValue)
	field.ComparisonOperator = strings.TrimSpace(strings.ToLower(field.ComparisonOperator))
	field.ComparisonValue = strings.TrimSpace(field.ComparisonValue)
	field.EnumValues = trimNonEmpty(field.EnumValues)
	field.UpdatedAt = now
	if field.CreatedAt.IsZero() {
		field.CreatedAt = now
	}
	if !keepID && field.ID == "" {
		field.ID = id.New("field")
	}
	if field.Name == "" {
		return ingestiondomain.FieldDefinition{}, fmt.Errorf("field name is required")
	}
	if field.DisplayName == "" {
		field.DisplayName = field.Name
	}
	switch field.DataType {
	case ingestiondomain.FieldDataTypeBoolean, ingestiondomain.FieldDataTypeEnum, ingestiondomain.FieldDataTypeNumber, ingestiondomain.FieldDataTypeString:
	default:
		return ingestiondomain.FieldDefinition{}, fmt.Errorf("field data type is required")
	}
	if field.DataType == ingestiondomain.FieldDataTypeEnum && len(field.EnumValues) == 0 {
		return ingestiondomain.FieldDefinition{}, fmt.Errorf("enum fields require at least one value")
	}
	if field.DataType != ingestiondomain.FieldDataTypeEnum {
		field.EnumValues = nil
	}
	if field.DataType == ingestiondomain.FieldDataTypeBoolean && field.ComparisonOperator != "" {
		switch field.ComparisonOperator {
		case "eq", "gt", "lt", "contains":
		default:
			return ingestiondomain.FieldDefinition{}, fmt.Errorf("unsupported comparison operator")
		}
		if field.ComparisonValue == "" {
			return ingestiondomain.FieldDefinition{}, fmt.Errorf("comparison value is required")
		}
	} else if field.DataType != ingestiondomain.FieldDataTypeBoolean {
		field.ComparisonOperator = ""
		field.ComparisonValue = ""
	}
	return field, nil
}

func firstNonEmptyString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func firstNonEmptyFieldType(value, fallback ingestiondomain.FieldDataType) ingestiondomain.FieldDataType {
	if value == "" {
		return fallback
	}
	return value
}

func chooseStringSlice(value, fallback []string) []string {
	if value == nil {
		return fallback
	}
	return value
}

func trimNonEmpty(items []string) []string {
	trimmed := make([]string, 0, len(items))
	for _, item := range items {
		value := strings.TrimSpace(item)
		if value != "" {
			trimmed = append(trimmed, value)
		}
	}
	if len(trimmed) == 0 {
		return nil
	}
	return trimmed
}

func chooseStringValue(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}
