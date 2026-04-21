import type { NotificationFilters } from "@/services/notifications/notifications.types";

/**
 * Defines stable query keys for notification data.
 */
export const notificationKeys = {
    list: (filters: NotificationFilters) => ["me", "notifications", filters] as const,
};