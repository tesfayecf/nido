export interface AnalyticsRecord {
    readonly property_id: string;
    readonly property_label?: string;
    readonly property_url: string;
    readonly source_id?: string;
    readonly status: string;
    readonly observed_at: string;
    readonly values: Record<string, string>;
}
