/**
 * Defines stable query keys for source data.
 */
export const sourceKeys = {
    detail: (sourceId: string) => ["backoffice", "sources", "detail", sourceId] as const,
    list: () => ["backoffice", "sources", "list"] as const,
};