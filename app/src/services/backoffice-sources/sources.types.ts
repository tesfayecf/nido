/**
 * Mirrors the backend source payload.
 */
export interface Source {
    readonly active: boolean;
    readonly browser_enabled: boolean;
    readonly config_json?: string;
    readonly created_at?: string;
    readonly endpoint_url: string;
    readonly freshness_window_seconds?: number;
    readonly id: string;
    readonly kind: string;
    readonly last_run_at?: string;
    readonly name: string;
    readonly next_run_at?: string;
    readonly rate_limit_max_requests?: number;
    readonly rate_limit_window_seconds?: number;
    readonly retry_backoff_millis?: number;
    readonly retry_max_attempts?: number;
    readonly schedule_interval_seconds?: number;
    readonly updated_at?: string;
}