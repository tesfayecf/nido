import type { NotificationFilters } from "@/services/notifications/notifications.types";

const notificationsRoot = ["me", "notifications"] as const;

/**
 * Defines stable query keys for notification data.
 */
export const notificationKeys = {
    all: () => notificationsRoot,
    list: (filters: NotificationFilters) => [...notificationsRoot, filters] as const,
};
