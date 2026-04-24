package domain

import "time"

// FieldDataType describes the canonical type enforced for a reusable field.
type FieldDataType string

const (
	FieldDataTypeNumber  FieldDataType = "number"
	FieldDataTypeString  FieldDataType = "string"
	FieldDataTypeBoolean FieldDataType = "boolean"
	FieldDataTypeEnum    FieldDataType = "enum"
)

// FieldDefinition is a reusable canonical field shared across properties.
type FieldDefinition struct {
	ID            string        `json:"id"`
	Name          string        `json:"name"`
	DisplayName   string        `json:"display_name"`
	DataType      FieldDataType `json:"data_type"`
	Unit          string        `json:"unit,omitempty"`
	Description   string        `json:"description,omitempty"`
	EnumValues    []string      `json:"enum_values,omitempty"`
	SystemDefined bool          `json:"system_defined"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

// FieldDefinitionUsage summarizes how a field is used across tracked properties.
type FieldDefinitionUsage struct {
	FieldDefinition
	PropertiesUsing int `json:"properties_using"`
	ValueCount      int `json:"value_count"`
	UnmappedCount   int `json:"unmapped_count,omitempty"`
}

// PropertyFieldValue stores one normalized value captured for a property snapshot.
type PropertyFieldValue struct {
	ID                string     `json:"id"`
	PropertyID        string     `json:"property_id"`
	SnapshotID        string     `json:"snapshot_id"`
	FieldDefinitionID string     `json:"field_definition_id,omitempty"`
	FieldName         string     `json:"field_name,omitempty"`
	SelectorName      string     `json:"selector_name"`
	Value             string     `json:"value"`
	ObservedAt        time.Time  `json:"observed_at"`
	ValidationStatus  string     `json:"validation_status"`
	ValidationMessage string     `json:"validation_message,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

// UnmappedFieldGroup summarizes a set of captured values that still need canonical mapping.
type UnmappedFieldGroup struct {
	PropertyID      string    `json:"property_id"`
	PropertyLabel   string    `json:"property_label,omitempty"`
	SelectorName    string    `json:"selector_name"`
	SampleValue     string    `json:"sample_value,omitempty"`
	ObservedAt      time.Time `json:"observed_at"`
	ValueCount      int       `json:"value_count"`
	ConfigVersion   int       `json:"config_version,omitempty"`
	AssignedField   string    `json:"assigned_field,omitempty"`
	AssignedFieldID string    `json:"assigned_field_id,omitempty"`
}
