export const fieldKeys = {
    all: ["fields"] as const,
    list: () => [...fieldKeys.all, "list"] as const,
};
