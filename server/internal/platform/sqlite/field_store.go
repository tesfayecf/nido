package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	ingestiondomain "home-searcher/server/internal/ingestion/domain"
	"home-searcher/server/internal/platform/id"
)

func scanFieldDefinition(scanner scanner) (ingestiondomain.FieldDefinition, error) {
	var (
		field        ingestiondomain.FieldDefinition
		dataType     string
		enumJSON     string
		systemDefined int
		createdAt    string
		updatedAt    string
	)

	if err := scanner.Scan(
		&field.ID,
		&field.Name,
		&field.DisplayName,
		&dataType,
		&field.Unit,
		&field.Description,
		&enumJSON,
		&systemDefined,
		&createdAt,
		&updatedAt,
	); err != nil {
		return ingestiondomain.FieldDefinition{}, err
	}

	field.DataType = ingestiondomain.FieldDataType(dataType)
	field.EnumValues = decodeStringArrayJSON(enumJSON)
	field.SystemDefined = systemDefined == 1
	var err error
	field.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return ingestiondomain.FieldDefinition{}, err
	}
	field.UpdatedAt, err = parseTime(updatedAt)
	if err != nil {
		return ingestiondomain.FieldDefinition{}, err
	}

	return field, nil
}

// ListFieldDefinitions returns all canonical fields with usage counts.
func (s *Store) ListFieldDefinitions(ctx context.Context) ([]ingestiondomain.FieldDefinitionUsage, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			fd.id,
			fd.name,
			fd.display_name,
			fd.data_type,
			fd.unit,
			fd.description,
			fd.enum_values_json,
			fd.system_defined,
			fd.created_at,
			fd.updated_at,
			COUNT(DISTINCT pfv.property_id) AS properties_using,
			COUNT(pfv.id) AS value_count
		FROM field_definitions fd
		LEFT JOIN property_field_values pfv ON pfv.field_definition_id = fd.id
		GROUP BY fd.id, fd.name, fd.display_name, fd.data_type, fd.unit, fd.description, fd.enum_values_json, fd.system_defined, fd.created_at, fd.updated_at
		ORDER BY fd.system_defined DESC, fd.display_name ASC`)
	if err != nil {
		return nil, fmt.Errorf("list field definitions: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.FieldDefinitionUsage, 0)
	for rows.Next() {
		field, err := scanFieldDefinitionUsage(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, field)
	}

	return items, rows.Err()
}

func scanFieldDefinitionUsage(scanner scanner) (ingestiondomain.FieldDefinitionUsage, error) {
	var (
		usage         ingestiondomain.FieldDefinitionUsage
		dataType      string
		enumJSON      string
		systemDefined int
		createdAt     string
		updatedAt     string
	)
	if err := scanner.Scan(
		&usage.ID,
		&usage.Name,
		&usage.DisplayName,
		&dataType,
		&usage.Unit,
		&usage.Description,
		&enumJSON,
		&systemDefined,
		&createdAt,
		&updatedAt,
		&usage.PropertiesUsing,
		&usage.ValueCount,
	); err != nil {
		return ingestiondomain.FieldDefinitionUsage{}, err
	}
	usage.DataType = ingestiondomain.FieldDataType(dataType)
	usage.EnumValues = decodeStringArrayJSON(enumJSON)
	usage.SystemDefined = systemDefined == 1
	var err error
	usage.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return ingestiondomain.FieldDefinitionUsage{}, err
	}
	usage.UpdatedAt, err = parseTime(updatedAt)
	if err != nil {
		return ingestiondomain.FieldDefinitionUsage{}, err
	}
	return usage, nil
}

// GetFieldDefinition returns one field by identifier.
func (s *Store) GetFieldDefinition(ctx context.Context, fieldID string) (ingestiondomain.FieldDefinition, error) {
	return scanFieldDefinition(s.db.QueryRowContext(ctx, `SELECT id, name, display_name, data_type, unit, description, enum_values_json, system_defined, created_at, updated_at FROM field_definitions WHERE id = ?`, fieldID))
}

// GetFieldDefinitionByName returns one field by canonical name.
func (s *Store) GetFieldDefinitionByName(ctx context.Context, fieldName string) (ingestiondomain.FieldDefinition, error) {
	return scanFieldDefinition(s.db.QueryRowContext(ctx, `SELECT id, name, display_name, data_type, unit, description, enum_values_json, system_defined, created_at, updated_at FROM field_definitions WHERE name = ? COLLATE NOCASE`, fieldName))
}

// CreateFieldDefinition stores a new canonical field.
func (s *Store) CreateFieldDefinition(ctx context.Context, field ingestiondomain.FieldDefinition) error {
	enumJSON, _ := json.Marshal(field.EnumValues)
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO field_definitions (id, name, display_name, data_type, unit, description, enum_values_json, system_defined, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		field.ID,
		field.Name,
		field.DisplayName,
		string(field.DataType),
		field.Unit,
		field.Description,
		string(enumJSON),
		boolToInt(field.SystemDefined),
		formatTime(field.CreatedAt),
		formatTime(field.UpdatedAt),
	)
	if err != nil {
		return fmt.Errorf("create field definition: %w", err)
	}
	return nil
}

// UpdateFieldDefinition updates mutable field metadata.
func (s *Store) UpdateFieldDefinition(ctx context.Context, field ingestiondomain.FieldDefinition) error {
	enumJSON, _ := json.Marshal(field.EnumValues)
	result, err := s.db.ExecContext(
		ctx,
		`UPDATE field_definitions
		 SET display_name = ?, data_type = ?, unit = ?, description = ?, enum_values_json = ?, updated_at = ?
		 WHERE id = ?`,
		field.DisplayName,
		string(field.DataType),
		field.Unit,
		field.Description,
		string(enumJSON),
		formatTime(field.UpdatedAt),
		field.ID,
	)
	if err != nil {
		return fmt.Errorf("update field definition: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read updated field definition rows: %w", err)
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteFieldDefinition removes one field when it is unused.
func (s *Store) DeleteFieldDefinition(ctx context.Context, fieldID string) error {
	field, err := s.GetFieldDefinition(ctx, fieldID)
	if err != nil {
		return err
	}
	var usageCount int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM property_field_values WHERE field_definition_id = ?`, fieldID).Scan(&usageCount); err != nil {
		return fmt.Errorf("count field value usage: %w", err)
	}
	if usageCount > 0 {
		return fmt.Errorf("field is in use")
	}
	if err := s.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*)
		 FROM property_extraction_configs AS config,
		      json_each(
		          CASE
		              WHEN json_type(config.fields_json) = 'array' THEN config.fields_json
		              ELSE json_extract(config.fields_json, '$.fields')
		          END
		      ) AS field
		 WHERE json_extract(field.value, '$.field_name') = ?`,
		field.Name,
	).Scan(&usageCount); err != nil {
		return fmt.Errorf("count field config usage: %w", err)
	}
	if usageCount > 0 {
		return fmt.Errorf("field is in use")
	}

	result, err := s.db.ExecContext(ctx, `DELETE FROM field_definitions WHERE id = ?`, fieldID)
	if err != nil {
		return fmt.Errorf("delete field definition: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read deleted field definition rows: %w", err)
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// UpsertPropertyFieldValues normalizes one snapshot into the cross-property field table.
func (s *Store) UpsertPropertyFieldValues(ctx context.Context, snapshot ingestiondomain.PropertySnapshot, fields []ingestiondomain.FieldSelector) error {
	values := decodeSnapshotValues(string(snapshot.Values))
	if len(values) == 0 {
		return nil
	}

	fieldDefinitions, err := loadFieldDefinitionMap(ctx, s.db)
	if err != nil {
		return err
	}

	selectorFieldNames := make(map[string]string, len(fields))
	for _, field := range fields {
		selectorFieldNames[strings.TrimSpace(field.Name)] = strings.TrimSpace(field.FieldName)
	}

	for selectorName, value := range values {
		fieldName := selectorFieldNames[selectorName]
		fieldID := ""
		validationStatus := ingestiondomain.FieldValidationStatusUnmapped
		validationMessage := ""
		if definition, ok := fieldDefinitions[strings.ToLower(fieldName)]; ok {
			fieldID = definition.ID
			validationStatus, validationMessage = ingestiondomain.ValidateFieldValue(definition, value)
		}

		if _, err := s.db.ExecContext(
			ctx,
			`INSERT INTO property_field_values
				(id, property_id, snapshot_id, field_definition_id, field_name, selector_name, config_version, value_text, observed_at, validation_status, validation_message, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(snapshot_id, selector_name) DO UPDATE SET
			 	field_definition_id = excluded.field_definition_id,
			 	field_name = excluded.field_name,
			 	config_version = excluded.config_version,
			 	value_text = excluded.value_text,
			 	observed_at = excluded.observed_at,
			 	validation_status = excluded.validation_status,
			 	validation_message = excluded.validation_message`,
			fmt.Sprintf("%s:%s", snapshot.ID, selectorName),
			snapshot.PropertyID,
			snapshot.ID,
			nullableString(fieldID),
			fieldName,
			selectorName,
			snapshot.ConfigVersion,
			value,
			formatTime(snapshot.ObservedAt),
			validationStatus,
			validationMessage,
			formatTime(snapshot.ObservedAt),
		); err != nil {
			return fmt.Errorf("upsert property field value: %w", err)
		}
	}

	return nil
}

// ListUnmappedFieldGroups returns grouped normalized values that still need mapping.
func (s *Store) ListUnmappedFieldGroups(ctx context.Context) ([]ingestiondomain.UnmappedFieldGroup, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			pfv.property_id,
			p.label,
			pfv.selector_name,
			MIN(pfv.value_text) AS sample_value,
			MAX(pfv.observed_at) AS observed_at,
			COUNT(*) AS value_count,
			MAX(pfv.config_version) AS config_version
		FROM property_field_values pfv
		INNER JOIN properties p ON p.id = pfv.property_id
		WHERE pfv.field_definition_id IS NULL
		GROUP BY pfv.property_id, p.label, pfv.selector_name
		ORDER BY observed_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list unmapped field groups: %w", err)
	}
	defer rows.Close()

	items := make([]ingestiondomain.UnmappedFieldGroup, 0)
	for rows.Next() {
		var item ingestiondomain.UnmappedFieldGroup
		var observedAt string
		if err := rows.Scan(&item.PropertyID, &item.PropertyLabel, &item.SelectorName, &item.SampleValue, &observedAt, &item.ValueCount, &item.ConfigVersion); err != nil {
			return nil, fmt.Errorf("scan unmapped field group: %w", err)
		}
		item.ObservedAt, err = parseTime(observedAt)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

// ListAnalyticsRecords returns the latest normalized field values for each property.
func (s *Store) ListAnalyticsRecords(ctx context.Context) ([]ingestiondomain.AnalyticsPropertyRecord, error) {
	rows, err := s.db.QueryContext(ctx, `
		WITH ranked_snapshots AS (
			SELECT
				id,
				property_id,
				observed_at,
				ROW_NUMBER() OVER (
					PARTITION BY property_id
					ORDER BY observed_at DESC, id DESC
				) AS row_num
			FROM property_snapshots
		),
		latest_snapshots AS (
			SELECT id, property_id, observed_at
			FROM ranked_snapshots
			WHERE row_num = 1
		)
		SELECT
			p.id,
			p.label,
			p.url,
			p.source_id,
			p.status,
			ls.observed_at,
			fd.name,
			pfv.value_text
		FROM latest_snapshots ls
		INNER JOIN properties p ON p.id = ls.property_id
		LEFT JOIN property_field_values pfv
			ON pfv.snapshot_id = ls.id
			AND pfv.field_definition_id IS NOT NULL
			AND pfv.validation_status = ?
		LEFT JOIN field_definitions fd ON fd.id = pfv.field_definition_id
		ORDER BY p.label ASC, p.url ASC, COALESCE(fd.display_name, '') ASC`,
		ingestiondomain.FieldValidationStatusValid,
	)
	if err != nil {
		return nil, fmt.Errorf("list analytics records: %w", err)
	}
	defer rows.Close()

	records := make([]ingestiondomain.AnalyticsPropertyRecord, 0)
	indexByPropertyID := make(map[string]int)
	for rows.Next() {
		var (
			propertyID    string
			propertyLabel string
			propertyURL   string
			sourceID      string
			status        string
			observedAtRaw string
			fieldName     sql.NullString
			valueText     sql.NullString
		)
		if err := rows.Scan(&propertyID, &propertyLabel, &propertyURL, &sourceID, &status, &observedAtRaw, &fieldName, &valueText); err != nil {
			return nil, fmt.Errorf("scan analytics record: %w", err)
		}

		recordIndex, ok := indexByPropertyID[propertyID]
		if !ok {
			observedAt, err := parseTime(observedAtRaw)
			if err != nil {
				return nil, err
			}
			recordIndex = len(records)
			indexByPropertyID[propertyID] = recordIndex
			records = append(records, ingestiondomain.AnalyticsPropertyRecord{
				ObservedAt:    observedAt,
				PropertyID:    propertyID,
				PropertyLabel: propertyLabel,
				PropertyURL:   propertyURL,
				SourceID:      sourceID,
				Status:        status,
				Values:        map[string]string{},
			})
		}

		if fieldName.Valid && valueText.Valid {
			records[recordIndex].Values[fieldName.String] = valueText.String
		}
	}

	return records, rows.Err()
}

// RemapPropertyFieldValues updates normalized values for one property selector group.
func (s *Store) RemapPropertyFieldValues(ctx context.Context, propertyID, selectorName, fieldName string) error {
	definition, err := s.GetFieldDefinitionByName(ctx, fieldName)
	if err != nil {
		return err
	}

	rows, err := s.db.QueryContext(ctx, `SELECT id, value_text FROM property_field_values WHERE property_id = ? AND selector_name = ?`, propertyID, selectorName)
	if err != nil {
		return fmt.Errorf("query property field values for remap: %w", err)
	}
	defer rows.Close()

	type item struct {
		id    string
		value string
	}
	values := make([]item, 0)
	for rows.Next() {
		var current item
		if err := rows.Scan(&current.id, &current.value); err != nil {
			return fmt.Errorf("scan property field value for remap: %w", err)
		}
		values = append(values, current)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, current := range values {
		validationStatus, validationMessage := ingestiondomain.ValidateFieldValue(definition, current.value)
		if _, err := s.db.ExecContext(
			ctx,
			`UPDATE property_field_values
			 SET field_definition_id = ?, field_name = ?, validation_status = ?, validation_message = ?
			 WHERE id = ?`,
			definition.ID,
			definition.Name,
			validationStatus,
			validationMessage,
			current.id,
		); err != nil {
			return fmt.Errorf("update property field value remap: %w", err)
		}
	}

	return nil
}

// CreatePropertyConfigVersion writes a new property config version directly.
func (s *Store) CreatePropertyConfigVersion(ctx context.Context, config ingestiondomain.PropertyExtractionConfig) error {
	return s.UpsertPropertyConfig(ctx, config)
}

// NewFieldDefinitionID creates a store-compatible identifier.
func NewFieldDefinitionID() string {
	return id.New("field")
}

// NewPropertyFieldValueID creates a store-compatible identifier.
func NewPropertyFieldValueID() string {
	return id.New("pfv")
}

func trimStringSlice(items []string) []string {
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

func normalizeFieldDefinition(field ingestiondomain.FieldDefinition, now time.Time) ingestiondomain.FieldDefinition {
	field.ID = strings.TrimSpace(field.ID)
	field.Name = strings.TrimSpace(field.Name)
	field.DisplayName = strings.TrimSpace(field.DisplayName)
	field.Unit = strings.TrimSpace(field.Unit)
	field.Description = strings.TrimSpace(field.Description)
	field.EnumValues = trimStringSlice(field.EnumValues)
	if field.CreatedAt.IsZero() {
		field.CreatedAt = now
	}
	field.UpdatedAt = now
	return field
}
