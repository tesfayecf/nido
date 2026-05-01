import { DEFAULT_NOTIFICATION_PREFERENCES, normalizeNotificationPreferences } from "@/features/settings/settingsBackup";

export const PREFERENCE_STORAGE_KEY = "nido.notification-preferences";
export const WEEKLY_DIGEST_STORAGE_KEY = "nido.weekly-digest";

export const readNotificationPreferences = (): typeof DEFAULT_NOTIFICATION_PREFERENCES => {
    if (typeof window === "undefined") {
        return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    try {
        return normalizeNotificationPreferences(JSON.parse(window.localStorage.getItem(PREFERENCE_STORAGE_KEY) ?? "null"));
    } catch {
        return DEFAULT_NOTIFICATION_PREFERENCES;
    }
};
