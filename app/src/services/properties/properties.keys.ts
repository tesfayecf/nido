/**
 * Defines stable query keys for property data.
 */
export const propertyKeys = {
    all: () => ["properties"] as const,
    config: (propertyId: string) => ["properties", "config", propertyId] as const,
    detail: (propertyId: string) => ["properties", "detail", propertyId] as const,
    list: () => ["properties", "list"] as const,
    runs: (propertyId: string) => ["properties", "runs", propertyId] as const,
    snapshots: (propertyId: string) => ["properties", "snapshots", propertyId] as const,
};
