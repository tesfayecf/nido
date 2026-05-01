import { useEffect } from "react";

import { useToast } from "@/components/ui/ToastProvider";
import { PREFERENCE_STORAGE_KEY, WEEKLY_DIGEST_STORAGE_KEY, readNotificationPreferences } from "@/features/settings/localPreferences";
import { listNotifications } from "@/services/notifications/notifications.service";
import { listProperties, listPropertySummaries } from "@/services/properties/properties.service";

const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export const useWeeklyDigest = (): void => {
    const { pushToast } = useToast();

    useEffect(() => {
        let cancelled = false;
        const preferences = readNotificationPreferences();
        if (!preferences.digestMode) {
            return undefined;
        }

        const rawState = window.localStorage.getItem(WEEKLY_DIGEST_STORAGE_KEY);
        const now = Date.now();
        if (rawState !== null) {
            try {
                const parsed = JSON.parse(rawState) as { readonly lastSentAt?: string; };
                const lastSentAt = parsed.lastSentAt === undefined ? 0 : Date.parse(parsed.lastSentAt);
                if (Number.isFinite(lastSentAt) && now - lastSentAt < DIGEST_INTERVAL_MS) {
                    return undefined;
                }
            } catch {
                // ignore invalid local state and regenerate
            }
        }

        void (async () => {
            try {
                const since = new Date(now - DIGEST_INTERVAL_MS);
                const [properties, summaries, notifications] = await Promise.all([
                    listProperties(),
                    listPropertySummaries(),
                    listNotifications({ limit: 100, unread_only: false }),
                ]);
                if (cancelled) {
                    return;
                }

                const newProperties = properties.filter((property) => property.created_at !== undefined && Date.parse(property.created_at) >= since.getTime());
                const priceChanges = summaries.filter((summary) => summary.signals.some((signal) => signal.field === "price" || signal.field === "total_price"));
                const significantChanges = summaries.filter((summary) => summary.signals.length > 0 && summary.signals.some((signal) => signal.field !== "price" && signal.field !== "total_price"));
                const recentAlerts = notifications.items.filter((item) => Date.parse(item.created_at) >= since.getTime());

                const title = "Nido weekly digest";
                const lines = [
                    `${priceChanges.length} properties with price changes`,
                    `${newProperties.length} new properties added`,
                    `${recentAlerts.length} alerts triggered`,
                    `${significantChanges.length} significant field changes`,
                ];

                const hasDesktopChannel = preferences.channels.includes("in-app");
                if (hasDesktopChannel && "Notification" in window) {
                    if (Notification.permission === "granted") {
                        new Notification(title, { body: lines.join("\n") });
                    } else if (Notification.permission === "default") {
                        const permission = await Notification.requestPermission();
                        if (!cancelled && permission === "granted") {
                            new Notification(title, { body: lines.join("\n") });
                        }
                    }
                }

                pushToast(lines.join(" · "), "success");
                window.localStorage.setItem(WEEKLY_DIGEST_STORAGE_KEY, JSON.stringify({
                    lastSentAt: new Date(now).toISOString(),
                    source: PREFERENCE_STORAGE_KEY,
                }));
            } catch {
                if (!cancelled) {
                    pushToast("Could not prepare the weekly digest.", "error");
                }
            }
        })();

        return (): void => {
            cancelled = true;
        };
    }, [pushToast]);
};
