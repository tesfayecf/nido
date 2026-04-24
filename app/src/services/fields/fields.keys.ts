export const fieldKeys = {
    all: ["fields"] as const,
    list: () => [...fieldKeys.all, "list"] as const,
    unmapped: () => [...fieldKeys.all, "unmapped"] as const,
};
