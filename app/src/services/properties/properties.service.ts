import { apiRequest, type ItemEnvelope, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";

import type {
    FieldSelector,
    Property,
    PropertyExtractionConfig,
    PropertyListFilter,
    PropertyPreviewRequest,
    PropertyPreviewResult,
    PropertyRun,
    PropertySnapshot,
    PropertyUpsertRequest,
} from "@/services/properties/properties.types";

/**
 * Loads all tracked properties with optional filtering.
 *
 * @param filter Optional filter criteria.
 * @returns The property collection.
 */
export const listProperties = async (filter?: PropertyListFilter): Promise<Property[]> => {
    const params = new URLSearchParams();
    
    if (filter?.tagIds !== undefined && filter.tagIds.length > 0) {
        filter.tagIds.forEach((tagId) => {
            params.append("tag_id", tagId);
        });
    }
    
    if (filter?.tagMatch !== undefined) {
        params.append("tag_match", filter.tagMatch);
    }
    
    if (filter?.status !== undefined) {
        params.append("status", filter.status);
    }
    
    const queryString = params.toString();
    const path = queryString !== "" ? `/api/v1/backoffice/properties?${queryString}` : "/api/v1/backoffice/properties";
    
    const response = await apiRequest<ListEnvelope<Property>>({
        auth: true,
        path,
    });

    return response.items;
};

/**
 * Loads one property by identifier.
 *
 * @param propertyId The property identifier.
 * @returns The property detail.
 */
export const getProperty = async (propertyId: string): Promise<Property> => {
    const response = await apiRequest<ItemEnvelope<Property>>({
        auth: true,
        path: `/api/v1/backoffice/properties/${propertyId}`,
    });

    return response.item;
};

/**
 * Creates a new tracked property.
 *
 * @param req The property creation payload.
 * @returns The created property.
 */
export const createProperty = async (req: PropertyUpsertRequest): Promise<Property> => {
    const response = await apiRequest<ItemEnvelope<Property>, PropertyUpsertRequest>({
        auth: true,
        body: req,
        method: "POST",
        path: "/api/v1/backoffice/properties",
    });

    return response.item;
};

/**
 * Updates an existing property.
 *
 * @param propertyId The property identifier.
 * @param req The update payload.
 * @returns The updated property.
 */
export const updateProperty = async (propertyId: string, req: PropertyUpsertRequest): Promise<Property> => {
    const response = await apiRequest<ItemEnvelope<Property>, PropertyUpsertRequest>({
        auth: true,
        body: req,
        method: "PUT",
        path: `/api/v1/backoffice/properties/${propertyId}`,
    });

    return response.item;
};

/**
 * Deletes an existing tracked property.
 *
 * @param propertyId The property identifier.
 */
export const deleteProperty = async (propertyId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/backoffice/properties/${propertyId}`,
    });
};

/**
 * Saves a new extraction config version for a property.
 *
 * @param propertyId The property identifier.
 * @param fields The extraction field selectors.
 * @returns The saved config.
 */
export const upsertPropertyConfig = async (propertyId: string, fields: FieldSelector[]): Promise<PropertyExtractionConfig> => {
    const response = await apiRequest<ItemEnvelope<PropertyExtractionConfig>, { fields: FieldSelector[] }>({
        auth: true,
        body: { fields },
        method: "POST",
        path: `/api/v1/backoffice/properties/${propertyId}/config`,
    });

    return response.item;
};

/**
 * Loads the most recent extraction config for a property.
 *
 * @param propertyId The property identifier.
 * @returns The latest extraction config.
 */
export const getPropertyConfig = async (propertyId: string): Promise<PropertyExtractionConfig> => {
    const response = await apiRequest<ItemEnvelope<PropertyExtractionConfig>>({
        auth: true,
        path: `/api/v1/backoffice/properties/${propertyId}/config`,
    });

    return {
        ...response.item,
        fields: response.item.fields ?? [],
    };
};

/**
 * Lists all config versions for a property.
 *
 * @param propertyId The property identifier.
 * @returns The config history.
 */
export const listPropertyConfigVersions = async (propertyId: string): Promise<PropertyExtractionConfig[]> => {
    const response = await apiRequest<ListEnvelope<PropertyExtractionConfig>>({
        auth: true,
        path: `/api/v1/backoffice/properties/${propertyId}/config/versions`,
    });

    return response.items.map((item) => ({
        ...item,
        fields: item.fields ?? [],
    }));
};

/**
 * Loads one saved config version for a property.
 *
 * @param propertyId The property identifier.
 * @param version The config version.
 * @returns The config version.
 */
export const getPropertyConfigVersion = async (propertyId: string, version: number): Promise<PropertyExtractionConfig> => {
    const response = await apiRequest<ItemEnvelope<PropertyExtractionConfig>>({
        auth: true,
        path: `/api/v1/backoffice/properties/${propertyId}/config/versions/${version}`,
    });

    return {
        ...response.item,
        fields: response.item.fields ?? [],
    };
};

/**
 * Rolls the property config back to a previous version by creating a new version.
 *
 * @param propertyId The property identifier.
 * @param version The source version to restore.
 * @returns The new config version.
 */
export const rollbackPropertyConfig = async (propertyId: string, version: number): Promise<PropertyExtractionConfig> => {
    const response = await apiRequest<ItemEnvelope<PropertyExtractionConfig>, { version: number; }>({
        auth: true,
        body: { version },
        method: "POST",
        path: `/api/v1/backoffice/properties/${propertyId}/config/rollback`,
    });

    return {
        ...response.item,
        fields: response.item.fields ?? [],
    };
};

/**
 * Lists recent snapshots for a property.
 *
 * @param propertyId The property identifier.
 * @param limit Optional result cap.
 * @returns The snapshot collection.
 */
export const listPropertySnapshots = async (propertyId: string, limit?: number): Promise<PropertySnapshot[]> => {
    const params = limit !== undefined ? `?limit=${limit}` : "";
    const response = await apiRequest<ListEnvelope<PropertySnapshot>>({
        auth: true,
        path: `/api/v1/backoffice/properties/${propertyId}/snapshots${params}`,
    });

    return response.items;
};

/**
 * Executes a stateless extraction preview without persisting any state.
 *
 * @param req The URL and field selectors to preview.
 * @returns The preview result.
 */
export const previewExtraction = async (req: PropertyPreviewRequest): Promise<PropertyPreviewResult> => {
    const response = await apiRequest<ItemEnvelope<PropertyPreviewResult>, PropertyPreviewRequest>({
        auth: true,
        body: req,
        method: "POST",
        path: "/api/v1/backoffice/properties/preview",
    });

    return response.item;
};

/**
 * Triggers a manual ingest for a property.
 *
 * @param propertyId The property identifier.
 * @returns The resulting snapshot.
 */
export const ingestProperty = async (propertyId: string): Promise<PropertySnapshot> => {
    const response = await apiRequest<ItemEnvelope<PropertySnapshot>>({
        auth: true,
        method: "POST",
        path: `/api/v1/backoffice/properties/${propertyId}/ingest`,
    });

    return response.item;
};

/**
 * Lists property automation runs.
 *
 * @param propertyId The property identifier.
 * @param limit Optional result cap.
 * @returns The property run collection.
 */
export const listPropertyRuns = async (propertyId: string, limit?: number): Promise<PropertyRun[]> => {
    const params = limit !== undefined ? `?limit=${limit}` : "";
    const response = await apiRequest<ListEnvelope<PropertyRun>>({
        auth: true,
        path: `/api/v1/backoffice/properties/${propertyId}/runs${params}`,
    });

    return response.items;
};
