export const workspaceKeys = {
    admin: () => ["workspace", "admin"] as const,
    analytics: (filters: Record<string, string | undefined>) => ["workspace", "analytics", filters] as const,
    audit: (propertyId: string) => ["workspace", "audit", propertyId] as const,
    deliveries: () => ["workspace", "deliveries"] as const,
    integrations: () => ["workspace", "integrations"] as const,
    maintenance: () => ["workspace", "maintenance"] as const,
    metadata: (propertyId: string) => ["workspace", "metadata", propertyId] as const,
    pauses: () => ["workspace", "pauses"] as const,
};
