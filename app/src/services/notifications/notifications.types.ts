export interface Notification {
    readonly alert_id?: string;
    readonly body: string;
    readonly created_at: string;
    readonly data?: unknown;
    readonly delivery_status: string;
    readonly id: string;
    readonly kind: string;
    readonly property_id?: string;
    readonly read_at?: string;
    readonly title: string;
}

export interface NotificationFilters {
    readonly limit: number;
    readonly unread_only: boolean;
}
