/**
 * File: app/src/services/backup/backup.types.ts
 *
 * Purpose:
 * Defines the backup frontend API contract, request helpers, query keys, or shared service types.
 *
 * Responsibilities:
 * - Describe typed request and response boundaries
 * - Centralize API paths, query keys, or service helpers
 * - Keep backend integration details out of rendering components
 *
 * Inputs:
 * - Imports: @/services/fields/fields.types, @/services/platform/platform.types, @/services/properties/properties.types, @/services/backoffice-sources/sources.types, @/services/tags/tags.types
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
 *
 * Dependencies:
 * - @/services/fields/fields.types
 * - @/services/platform/platform.types
 * - @/services/properties/properties.types
 * - @/services/backoffice-sources/sources.types
 * - @/services/tags/tags.types
 *
 * Key Decisions:
 * - Keeps documentation adjacent to the implementation so future changes update behavior and context together.
 * - Uses explicit imports and typed boundaries to make ownership traceable from this file in isolation.
 *
 * Constraints:
 * - Documentation must remain synchronized with behavior, tests, and related docs when this file changes.
 * - Runtime behavior must not depend on comments or documentation-only metadata.
 *
 * Related:
 * - /docs/frontend/documentation-template.md
 * - /docs/frontend/architecture-overview.md#api-contracts
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import type { FieldDefinition } from "@/services/fields/fields.types";
import type { PlatformSettings } from "@/services/platform/platform.types";
import type { Property, PropertyExtractionConfig, PropertyRun, PropertySnapshot } from "@/services/properties/properties.types";
import type { Source } from "@/services/backoffice-sources/sources.types";
import type { Tag } from "@/services/tags/tags.types";

/**
 * Documents the PropertyTagAssignment type contract used by app/src/services/backup/backup.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertyTagAssignment {
    readonly assigned_at: string;
    readonly property_id: string;
    readonly tag_id: string;
}

/**
 * Documents the PropertyFieldValueBackup type contract used by app/src/services/backup/backup.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertyFieldValueBackup {
    readonly config_version: number;
    readonly created_at: string;
    readonly field_definition_id?: string;
    readonly field_name?: string;
    readonly id: string;
    readonly observed_at: string;
    readonly property_id: string;
    readonly selector_name: string;
    readonly snapshot_id: string;
    readonly validation_message?: string;
    readonly validation_status: string;
    readonly value: string;
}

/**
 * Documents the WorkspaceDataBackup type contract used by app/src/services/backup/backup.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface WorkspaceDataBackup {
    readonly field_definitions: FieldDefinition[];
    readonly platform_settings: PlatformSettings;
    readonly properties: Property[];
    readonly property_configs: PropertyExtractionConfig[];
    readonly property_field_values: PropertyFieldValueBackup[];
    readonly property_runs: PropertyRun[];
    readonly property_snapshots: PropertySnapshot[];
    readonly property_tags: PropertyTagAssignment[];
    readonly schema_version: number;
    readonly sources: Source[];
    readonly tags: Tag[];
}

/**
 * Documents the BackupFileInfo type contract used by app/src/services/backup/backup.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface BackupFileInfo {
    readonly created_at: string;
    readonly name: string;
    readonly path: string;
    readonly size_bytes: number;
}

/**
 * Documents the MigrationStatus type contract used by app/src/services/backup/backup.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface MigrationStatus {
    readonly backup_path?: string;
    readonly current_version: number;
    readonly error?: string;
    readonly pending: boolean;
    readonly state: string;
    readonly strategy: string;
    readonly target_version: number;
}
