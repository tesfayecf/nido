import type { FieldDefinition } from "@/services/fields/fields.types";
import type { PlatformSettings } from "@/services/platform/platform.types";
import type { Property, PropertyExtractionConfig, PropertyRun, PropertySnapshot } from "@/services/properties/properties.types";
import type { Source } from "@/services/backoffice-sources/sources.types";
import type { Tag } from "@/services/tags/tags.types";

export interface PropertyTagAssignment {
    readonly assigned_at: string;
    readonly property_id: string;
    readonly tag_id: string;
}

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
