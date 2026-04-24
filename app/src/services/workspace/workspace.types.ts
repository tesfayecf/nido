export interface ExternalReference {
    readonly key: string;
    readonly value: string;
}

export interface AttachmentReference {
    readonly label: string;
    readonly url: string;
}

export interface PropertyMetadata {
    readonly acquisition_notes?: string;
    readonly attachments?: AttachmentReference[];
    readonly created_at?: string;
    readonly deal_thesis?: string;
    readonly expected_yield?: number;
    readonly external_references?: ExternalReference[];
    readonly pipeline_stage?: string;
    readonly priority: string;
    readonly property_id: string;
    readonly target_price?: number;
    readonly updated_at?: string;
    readonly workflow_state: "unreviewed" | "investigating" | "resolved";
}

export interface AuditLogEntry {
    readonly created_at: string;
    readonly id: string;
    readonly summary: string;
    readonly target_id: string;
    readonly target_kind: string;
}

export interface IntegrationConfig {
    readonly active: boolean;
    readonly created_at?: string;
    readonly filters?: Record<string, unknown>;
    readonly id?: string;
    readonly kind: "slack" | "email" | "webhook";
    readonly last_test_at?: string;
    readonly last_test_status?: string;
    readonly name: string;
    readonly retry_max_attempts?: number;
    readonly target: string;
    readonly updated_at?: string;
}

export interface IntegrationDelivery {
    readonly attempt_count: number;
    readonly created_at: string;
    readonly error_message?: string;
    readonly id: string;
    readonly integration_id: string;
    readonly property_id?: string;
    readonly status: string;
    readonly trigger_kind: string;
    readonly updated_at: string;
}

export interface AnalyticsPoint {
    readonly label: string;
    readonly value: number;
}

export interface AnalyticsPropertyStat {
    readonly label: string;
    readonly property_id: string;
    readonly value: number;
}

export interface AnalyticsSourceStat {
    readonly label: string;
    readonly source_id?: string;
    readonly value: number;
}

export interface PortfolioAnalytics {
    readonly alert_volume_trends: AnalyticsPoint[];
    readonly failure_rate_trends: AnalyticsPoint[];
    readonly largest_price_movers: AnalyticsPropertyStat[];
    readonly most_volatile_properties: AnalyticsPropertyStat[];
    readonly operational_risk: AnalyticsPropertyStat[];
    readonly price_change_trends: AnalyticsPoint[];
    readonly source_reliability: AnalyticsSourceStat[];
    readonly update_frequency_seconds: number;
}

export interface ImportPreviewRow {
    readonly errors?: string[];
    readonly label: string;
    readonly row: number;
    readonly url: string;
    readonly valid: boolean;
}

export interface ImportPreview {
    readonly rows: ImportPreviewRow[];
    readonly valid_count: number;
}

export interface SchedulerPause {
    readonly created_at?: string;
    readonly id?: string;
    readonly reason?: string;
    readonly scope_type: "property" | "source" | "tag";
    readonly scope_value: string;
}

export interface MaintenanceWindow {
    readonly created_at?: string;
    readonly ends_at: string;
    readonly id?: string;
    readonly name: string;
    readonly reason?: string;
    readonly starts_at: string;
}

export interface SystemHealth {
    readonly failure_distribution: AnalyticsSourceStat[];
    readonly processing_throughput: number;
    readonly queue_depth: number;
    readonly retry_rate: number;
}

export interface WorkspaceExport {
    readonly analytics: PortfolioAnalytics;
    readonly generated_at: string;
    readonly properties: { readonly id: string; readonly label: string; readonly url: string; }[];
}
