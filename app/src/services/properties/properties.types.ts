export type PropertyStatus = "pending" | "active" | "degraded" | "inactive";

export type SelectorType = "css" | "xpath" | "attribute" | "text";

export type ExtractionMode = "text" | "attribute";

export type TextMode = "textContent" | "innerText";

export interface FieldSelector {
    readonly name: string;
    readonly field_name?: string;
    readonly selector_type: SelectorType;
    readonly selector_value: string;
    readonly fallback_selectors?: string[];
    readonly extraction_mode: ExtractionMode;
    readonly text_mode?: TextMode;
    readonly attribute?: string;
    readonly transform?: string;
    readonly default_value?: string;
    readonly use_default_when_missing?: boolean;
    readonly regex_pattern?: string;
    readonly split_delimiter?: string;
    readonly multi_value?: boolean;
    readonly partial_match?: string;
    readonly comparison_operator?: "" | "eq" | "gt" | "lt" | "contains";
    readonly comparison_value?: string;
    readonly required: boolean;
}

export interface PropertyExtractionConfig {
    readonly id: string;
    readonly property_id: string;
    readonly fields: FieldSelector[];
    readonly version: number;
    readonly created_at: string;
    readonly change_summary?: string;
}

export interface PropertyReference {
    readonly label: string;
    readonly value: string;
}

export interface PropertyAttachment {
    readonly label: string;
    readonly url: string;
}

export interface PropertyMetadata {
    readonly priority_level?: string;
    readonly business_stage?: string;
    readonly target_price?: number;
    readonly expected_rent?: number;
    readonly expected_yield_bps?: number;
    readonly acquisition_notes?: string;
    readonly deal_thesis?: string;
    readonly external_references?: PropertyReference[];
    readonly attachments?: PropertyAttachment[];
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
    readonly paused?: boolean;
    readonly pause_reason?: string;
    readonly metadata?: PropertyMetadata;
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
    readonly fields: PropertyPreviewFieldResult[];
    readonly failures?: string[];
    readonly success: boolean;
}

export type PreviewErrorCode =
    | "ok"
    | "selector_invalid"
    | "unsupported_type"
    | "no_match"
    | "attribute_missing"
    | "empty_value"
    | "transform_failed";

export interface PropertyPreviewFieldResult {
    readonly name: string;
    readonly selector_type: SelectorType;
    readonly selector_value: string;
    readonly extraction_mode: ExtractionMode;
    readonly text_mode?: TextMode;
    readonly matched_selector?: string;
    readonly match_count: number;
    readonly used_fallback?: boolean;
    readonly value?: string;
    readonly success: boolean;
    readonly message?: string;
    readonly error_code?: PreviewErrorCode;
}

export interface PropertyUpsertRequest {
    readonly url: string;
    readonly label: string;
    readonly source_id?: string;
    readonly schedule_interval_seconds?: number;
    readonly retry_max_attempts?: number;
    readonly retry_backoff_millis?: number;
    readonly paused?: boolean;
    readonly pause_reason?: string;
    readonly metadata?: PropertyMetadata;
}

export type PropertyRunStatus = "pending" | "running" | "success" | "failed";

export interface PropertyRun {
    readonly id: string;
    readonly property_id: string;
    readonly status: PropertyRunStatus;
    readonly trigger_kind: string;
    readonly attempt_count: number;
    readonly max_attempts: number;
    readonly started_at?: string;
    readonly finished_at?: string;
    readonly error_message?: string;
    readonly snapshot_id?: string;
    readonly created_at: string;
}

export interface PropertyListFilter {
    readonly tagIds?: string[];
    readonly tagMatch?: "any" | "all";
    readonly status?: string;
    readonly priorityLevel?: string;
    readonly businessStage?: string;
}
