import { apiRequest, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";

import type { Notification, NotificationFilters } from "@/services/notifications/notifications.types";

export const listNotifications = async (filters: NotificationFilters): Promise<ListEnvelope<Notification>> => {
    const params = new URLSearchParams();
    params.set("unread_only", `${filters.unread_only}`);
    params.set("limit", `${filters.limit}`);

    return apiRequest<ListEnvelope<Notification>>({
        auth: true,
        path: `/api/v1/me/notifications?${params.toString()}`,
    });
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "POST",
        path: `/api/v1/me/notifications/${notificationId}/read`,
    });
};

export const markNotificationUnread = async (notificationId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "POST",
        path: `/api/v1/me/notifications/${notificationId}/unread`,
    });
};
