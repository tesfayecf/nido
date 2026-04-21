import { apiRequest, type ItemEnvelope, type ListEnvelope } from "@/lib/api/client";

import type {
    FieldSelector,
    Property,
    PropertyExtractionConfig,
    PropertyPreviewRequest,
    PropertyPreviewResult,
    PropertySnapshot,
    PropertyUpsertRequest,
} from "@/services/properties/properties.types";

/**
 * Loads all tracked properties.
 *
 * @returns The property collection.
 */
export const listProperties = async (): Promise<Property[]> => {
    const response = await apiRequest<ListEnvelope<Property>>({
        auth: true,
        path: "/api/v1/backoffice/properties",
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

    return response.item;
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
