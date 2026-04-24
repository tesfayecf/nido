export const platformKeys = {
    all: () => ["platform"] as const,
    deliveries: () => [...platformKeys.all(), "deliveries"] as const,
    settings: () => [...platformKeys.all(), "settings"] as const,
    summary: () => [...platformKeys.all(), "summary"] as const,
};
