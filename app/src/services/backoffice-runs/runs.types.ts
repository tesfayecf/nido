export interface Run {
    readonly change_flags?: Record<string, boolean>;
    readonly config_version: number;
    readonly error_message?: string;
    readonly id: string;
    readonly is_valid: boolean;
    readonly observed_at: string;
    readonly property_id: string;
    readonly values: Record<string, string>;
}

export interface RunFilters {
    readonly limit: number;
    readonly property_id: string;
}
