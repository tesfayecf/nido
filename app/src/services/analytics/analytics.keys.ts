export const analyticsKeys = {
    all: ["analytics"] as const,
    dataset: () => [...analyticsKeys.all, "dataset"] as const,
};
