import { apiRequest, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";

import type { Notification, NotificationFilters } from "@/services/notifications/notifications.types";

/**
 * Loads notifications for the current user.
 *
 * @param filters The current list filters.
 * @returns The notification collection.
 */
export const listNotifications = async (filters: NotificationFilters): Promise<ListEnvelope<Notification>> => {
    const params = new URLSearchParams();
    params.set("unread_only", `${filters.unread_only}`);
    params.set("limit", `${filters.limit}`);

    return apiRequest<ListEnvelope<Notification>>({
        auth: true,
        path: `/api/v1/me/notifications?${params.toString()}`,
    });
};

/**
 * Marks one notification as read.
 *
 * @param notificationId The notification identifier.
 */
export const markNotificationRead = async (notificationId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "POST",
        path: `/api/v1/me/notifications/${notificationId}/read`,
    });
};