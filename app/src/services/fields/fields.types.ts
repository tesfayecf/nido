export type FieldDataType = "number" | "string" | "boolean" | "enum";

export interface FieldDefinition {
    readonly id: string;
    readonly name: string;
    readonly display_name: string;
    readonly data_type: FieldDataType;
    readonly unit?: string;
    readonly description?: string;
    readonly enum_values?: string[];
    readonly system_defined: boolean;
    readonly created_at: string;
    readonly updated_at: string;
}

export interface FieldDefinitionUsage extends FieldDefinition {
    readonly properties_using: number;
    readonly value_count: number;
}

export interface UnmappedFieldGroup {
    readonly property_id: string;
    readonly property_label?: string;
    readonly selector_name: string;
    readonly sample_value?: string;
    readonly observed_at: string;
    readonly value_count: number;
    readonly config_version?: number;
}

export interface AssignUnmappedFieldRequest {
    readonly property_id: string;
    readonly selector_name: string;
    readonly field_name: string;
}
