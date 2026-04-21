/**
 * Mirrors the backend notification payload.
 */
export interface Notification {
    readonly body: string;
    readonly created_at: string;
    readonly data?: unknown;
    readonly delivery_status: string;
    readonly id: string;
    readonly kind: string;
    readonly listing_id?: string;
    readonly read_at?: string;
    readonly rule_id?: string;
    readonly title: string;
    readonly user_id: string;
}

/**
 * Describes the notification list filter set.
 */
export interface NotificationFilters {
    readonly limit: number;
    readonly unread_only: boolean;
}