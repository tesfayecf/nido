export type FieldDataType = "number" | "string" | "boolean" | "enum";

export interface FieldDefinition {
    readonly id: string;
    readonly name: string;
    readonly display_name: string;
    readonly data_type: FieldDataType;
    readonly unit?: string;
    readonly description?: string;
    readonly enum_values?: string[];
    readonly default_value?: string;
    readonly use_default_when_missing?: boolean;
    readonly comparison_operator?: "" | "eq" | "gt" | "lt" | "contains";
    readonly comparison_value?: string;
    readonly system_defined: boolean;
    readonly created_at: string;
    readonly updated_at: string;
}

export interface FieldDefinitionUsage extends FieldDefinition {
    readonly properties_using: number;
    readonly value_count: number;
}
