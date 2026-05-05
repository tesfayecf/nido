/**
 * File: app/src/services/properties/properties.types.ts
 *
 * Purpose:
 * Defines the properties frontend API contract, request helpers, query keys, or shared service types.
 *
 * Responsibilities:
 * - Describe typed request and response boundaries
 * - Centralize API paths, query keys, or service helpers
 * - Keep backend integration details out of rendering components
 *
 * Inputs:
 * - Module imports, constants, browser APIs, or caller-provided parameters as declared below
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
 *
 * Dependencies:
 * - TypeScript compiler
 * - Vite module graph
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
export type PropertyStatus = "pending" | "active" | "degraded" | "inactive";

/**
 * Documents the SelectorType type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export type SelectorType = "css" | "xpath" | "attribute" | "text";

/**
 * Documents the ExtractionMode type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export type ExtractionMode = "text" | "attribute";

/**
 * Documents the TextMode type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export type TextMode = "textContent" | "innerText";

/**
 * Documents the FieldRole type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export type FieldRole = "prefill" | "tracked";

/**
 * Documents the FieldSelector type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
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
    readonly field_role?: FieldRole;
    readonly property_override?: boolean;
    readonly required: boolean;
    readonly template_field_name?: string;
    readonly template_signature?: string;
}

/**
 * Documents the PropertyExtractionConfig type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertyExtractionConfig {
    readonly id: string;
    readonly property_id: string;
    readonly fields: FieldSelector[];
    readonly version: number;
    readonly created_at: string;
    readonly change_summary?: string;
}

/**
 * Documents the PropertyReference type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertyReference {
    readonly label: string;
    readonly value: string;
}

/**
 * Documents the PropertyAttachment type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertyAttachment {
    readonly label: string;
    readonly url: string;
}

/**
 * Documents the PropertyTrackingMode type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export type PropertyTrackingMode = "automatic" | "manual";

/**
 * Documents the PropertyMetadata type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertyMetadata {
    readonly priority_level?: string;
    readonly business_stage?: string;
    readonly tracking_mode?: PropertyTrackingMode;
    readonly target_price?: number;
    readonly expected_rent?: number;
    readonly expected_yield_bps?: number;
    readonly acquisition_notes?: string;
    readonly deal_thesis?: string;
    readonly external_references?: PropertyReference[];
    readonly attachments?: PropertyAttachment[];
}

/**
 * Documents the Property type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
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

/**
 * Documents the PropertySnapshot type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
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

/**
 * Documents the PropertyManualData type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export type PropertyManualData = Record<string, number | string | undefined>;

/**
 * Documents the PropertyPreviewRequest type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertyPreviewRequest {
    readonly url: string;
    readonly fields: FieldSelector[];
}

/**
 * Documents the PropertyPreviewResult type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertyPreviewResult {
    readonly values: Record<string, string>;
    readonly fields: PropertyPreviewFieldResult[];
    readonly failures?: string[];
    readonly success: boolean;
}

/**
 * Documents the PreviewErrorCode type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export type PreviewErrorCode =
    | "ok"
    | "selector_invalid"
    | "unsupported_type"
    | "no_match"
    | "attribute_missing"
    | "empty_value"
    | "transform_failed";

/**
 * Documents the PropertyPreviewFieldResult type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
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

/**
 * Documents the PropertyUpsertRequest type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertyUpsertRequest {
    readonly url: string;
    readonly label: string;
    readonly source_id?: string;
    readonly status?: PropertyStatus;
    readonly schedule_interval_seconds?: number;
    readonly retry_max_attempts?: number;
    readonly retry_backoff_millis?: number;
    readonly paused?: boolean;
    readonly pause_reason?: string;
    readonly metadata?: PropertyMetadata;
    readonly manual_data?: PropertyManualData;
}

/**
 * Documents the PropertyRunStatus type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export type PropertyRunStatus = "pending" | "running" | "success" | "failed";

/**
 * Documents the PropertyRun type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
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

/**
 * Documents the PropertyListFilter type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertyListFilter {
    readonly tagIds?: string[];
    readonly tagMatch?: "any" | "all";
    readonly status?: string;
    readonly priorityLevel?: string;
    readonly businessStage?: string;
}

// ── Change Intelligence Layer ─────────────────────────────────────────────────

/**
 * Documents the ChangeImpact type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export type ChangeImpact = "positive" | "negative" | "neutral";
/**
 * Documents the ChangeGroup type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export type ChangeGroup = "pricing" | "status" | "data_quality" | "freshness" | "listing_facts";

/**
 * Documents the ChangeSignal type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface ChangeSignal {
    readonly field: string;
    readonly label: string;
    readonly previous?: string;
    readonly current?: string;
    readonly absolute_delta?: number;
    readonly percent_delta?: number;
    readonly observed_at: string;
    readonly impact: ChangeImpact;
    readonly group: ChangeGroup;
}

/**
 * Documents the DecisionContext type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface DecisionContext {
    readonly current_price?: number;
    readonly target_price?: number;
    readonly price_gap_absolute?: number;
    readonly price_gap_percent?: number;
    readonly current_price_per_sqm?: number;
    readonly expected_yield_bps?: number;
    readonly stage?: string;
    readonly priority_level?: string;
    readonly deal_thesis_summary?: string;
    readonly freshness_status: "aging" | "fresh" | "stale" | "unknown";
    readonly last_observed_at?: string;
}

/**
 * Documents the PropertySummary type contract used by app/src/services/properties/properties.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertySummary {
    readonly property: Property;
    readonly current_values: Record<string, string>;
    readonly decision: DecisionContext;
    readonly signals: ChangeSignal[];
    readonly latest_change_summary: string;
}
