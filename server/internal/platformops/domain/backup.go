/**
 * File: internal/platformops/domain/backup.go
 *
 * Purpose:
 * Defines domain data structures and normalization rules for this backend area.
 *
 * Responsibilities:
 * - Define data contracts
 * - Normalize values used across layers
 * - Keep business terminology centralized
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - fmt
 * - strings
 * - time
 * - nido/server/internal/ingestion/domain
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package domain

import (
	"fmt"
	"strings"
	"time"

	ingestiondomain "nido/server/internal/ingestion/domain"
)

const WorkspaceBackupSchemaVersion = 1

/**
 * Purpose:
 * Defines the WorkspaceBackup struct used by this package and its consumers.
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

/**
 * Purpose:
 * Defines the BackupFileInfo struct used by this package and its consumers.
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
type BackupFileInfo struct {
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	SizeBytes int64     `json:"size_bytes"`
	CreatedAt time.Time `json:"created_at"`
}

/**
 * Purpose:
 * Defines the WorkspaceBackupPropertyTag struct used by this package and its consumers.
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
type WorkspaceBackupPropertyTag struct {
	PropertyID string    `json:"property_id"`
	TagID      string    `json:"tag_id"`
	AssignedAt time.Time `json:"assigned_at"`
}

/**
 * Purpose:
 * Defines the WorkspaceBackupPropertyFieldValue struct used by this package and its consumers.
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

/**
 * Purpose:
 * Performs the NormalizeWorkspaceBackup operation for this backend package.
 *
 * Parameters:
 * - backup WorkspaceBackup
 *
 * Returns:
 * - (WorkspaceBackup, error)
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
