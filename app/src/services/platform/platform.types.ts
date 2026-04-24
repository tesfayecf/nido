export interface IntegrationChannelConfig {
    readonly url?: string;
    readonly events?: string[];
}

export interface EmailDigestConfig {
    readonly enabled: boolean;
    readonly recipient?: string;
    readonly schedule?: string;
    readonly events?: string[];
    readonly last_sent_at?: string;
}

export interface PlatformSettings {
    readonly id: string;
    readonly scheduler_enabled: boolean;
    readonly maintenance_window_enabled: boolean;
    readonly maintenance_window_start?: string;
    readonly maintenance_window_end?: string;
    readonly webhook: IntegrationChannelConfig;
    readonly slack: IntegrationChannelConfig;
    readonly spreadsheet: IntegrationChannelConfig;
    readonly task_system: IntegrationChannelConfig;
    readonly email_digest: EmailDigestConfig;
    readonly updated_at?: string;
}

export interface SchedulerSummary {
    readonly scheduler_enabled: boolean;
    readonly maintenance_window_active: boolean;
    readonly maintenance_window_enabled: boolean;
    readonly running_properties: number;
    readonly due_properties: number;
    readonly tracked_properties: number;
    readonly paused_properties: number;
    readonly queue_depth: number;
    readonly runs_last_24_hours: number;
    readonly failures_last_24_hours: number;
    readonly success_rate: number;
    readonly last_updated_at: string;
}

export interface IntegrationDeliveryLog {
    readonly id: string;
    readonly channel: string;
    readonly event_type: string;
    readonly target?: string;
    readonly status: string;
    readonly attempt_count: number;
    readonly payload?: Record<string, unknown> | string;
    readonly response_status?: number;
    readonly error_message?: string;
    readonly delivered_at?: string;
    readonly created_at: string;
}
