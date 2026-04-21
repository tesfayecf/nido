/**
 * Mirrors the backend ingestion run payload.
 */
export interface Run {
    readonly artifact_key?: string;
    readonly attempt_count: number;
    readonly correlation_id: string;
    readonly diagnostics?: unknown;
    readonly error_message?: string;
    readonly failure_artifact_key?: string;
    readonly finished_at?: string;
    readonly id: string;
    readonly item_count: number;
    readonly source_id: string;
    readonly started_at: string;
    readonly status: "completed" | "failed" | "running";
    readonly trigger_kind: string;
}

/**
 * Describes run list filters.
 */
export interface RunFilters {
    readonly limit: number;
    readonly source_id: string;
}