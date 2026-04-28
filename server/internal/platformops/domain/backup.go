package domain

import (
	"fmt"
	"strings"
	"time"

	ingestiondomain "nido/server/internal/ingestion/domain"
)

const WorkspaceBackupSchemaVersion = 1

type WorkspaceBackup struct {
	SchemaVersion       int                                        `json:"schema_version"`
	PlatformSettings    PlatformSettings                           `json:"platform_settings"`
	Sources             []ingestiondomain.Source                   `json:"sources"`
	Properties          []ingestiondomain.Property                 `json:"properties"`
	PropertyConfigs     []ingestiondomain.PropertyExtractionConfig `json:"property_configs"`
	PropertySnapshots   []ingestiondomain.PropertySnapshot         `json:"property_snapshots"`
	PropertyRuns        []ingestiondomain.PropertyRun              `json:"property_runs"`
	Tags                []ingestiondomain.Tag                      `json:"tags"`
	PropertyTags        []WorkspaceBackupPropertyTag               `json:"property_tags"`
	FieldDefinitions    []ingestiondomain.FieldDefinition          `json:"field_definitions"`
	PropertyFieldValues []WorkspaceBackupPropertyFieldValue        `json:"property_field_values"`
}

type WorkspaceBackupPropertyTag struct {
	PropertyID string    `json:"property_id"`
	TagID      string    `json:"tag_id"`
	AssignedAt time.Time `json:"assigned_at"`
}

type WorkspaceBackupPropertyFieldValue struct {
	ID                string    `json:"id"`
	PropertyID        string    `json:"property_id"`
	SnapshotID        string    `json:"snapshot_id"`
	FieldDefinitionID string    `json:"field_definition_id,omitempty"`
	FieldName         string    `json:"field_name,omitempty"`
	SelectorName      string    `json:"selector_name"`
	ConfigVersion     int       `json:"config_version"`
	Value             string    `json:"value"`
	ObservedAt        time.Time `json:"observed_at"`
	ValidationStatus  string    `json:"validation_status"`
	ValidationMessage string    `json:"validation_message,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
}

func NormalizeWorkspaceBackup(backup WorkspaceBackup) (WorkspaceBackup, error) {
	switch backup.SchemaVersion {
	case 0:
		backup.SchemaVersion = WorkspaceBackupSchemaVersion
	case WorkspaceBackupSchemaVersion:
	default:
		return WorkspaceBackup{}, fmt.Errorf("unsupported backup schema version %d", backup.SchemaVersion)
	}

	if strings.TrimSpace(backup.PlatformSettings.ID) == "" {
		backup.PlatformSettings.ID = "platform"
	}
	if strings.TrimSpace(backup.PlatformSettings.EmailDigest.Schedule) == "" {
		backup.PlatformSettings.EmailDigest.Schedule = "09:00"
	}
	if backup.PlatformSettings.UpdatedAt.IsZero() {
		backup.PlatformSettings.UpdatedAt = time.Now().UTC()
	}

	return backup, nil
}
