/**
 * Defines stable query keys for tag data.
 */
export const tagKeys = {
    all: () => ["tags"] as const,
    list: () => ["tags", "list"] as const,
    propertyTags: (propertyId: string) => ["tags", "property", propertyId] as const,
};
