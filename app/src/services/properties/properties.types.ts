export type PropertyStatus = "pending" | "active" | "degraded" | "inactive";

export interface FieldSelector {
    readonly name: string;
    readonly selectors: string[];
    readonly attribute?: string;
    readonly transform?: string;
    readonly required: boolean;
}

export interface PropertyExtractionConfig {
    readonly id: string;
    readonly property_id: string;
    readonly fields: FieldSelector[];
    readonly version: number;
    readonly created_at: string;
}

export interface Property {
    readonly id: string;
    readonly url: string;
    readonly label: string;
    readonly source_id?: string;
    readonly status: PropertyStatus;
    readonly schedule_interval_seconds?: number;
    readonly retry_max_attempts?: number;
    readonly retry_backoff_millis?: number;
    readonly last_run_at?: string;
    readonly next_run_at?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
}

export interface PropertySnapshot {
    readonly id: string;
    readonly property_id: string;
    readonly config_version: number;
    readonly observed_at: string;
    readonly values: Record<string, string>;
    readonly change_flags?: Record<string, boolean>;
    readonly is_valid: boolean;
    readonly error_message?: string;
}

export interface PropertyPreviewRequest {
    readonly url: string;
    readonly fields: FieldSelector[];
}

export interface PropertyPreviewResult {
    readonly values: Record<string, string>;
    readonly failures?: string[];
    readonly success: boolean;
}

export interface PropertyUpsertRequest {
    readonly url: string;
    readonly label: string;
    readonly source_id?: string;
    readonly schedule_interval_seconds?: number;
    readonly retry_max_attempts?: number;
    readonly retry_backoff_millis?: number;
}
