import { apiRequest, type ItemEnvelope, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";

import type { Tag, TagUpsertRequest } from "@/services/tags/tags.types";

/**
 * Loads all tags.
 *
 * @returns The tag collection.
 */
export const listTags = async (): Promise<Tag[]> => {
    const response = await apiRequest<ListEnvelope<Tag>>({
        auth: true,
        path: "/api/v1/backoffice/tags",
    });

    return response.items;
};

/**
 * Creates a new tag.
 *
 * @param req The tag creation payload.
 * @returns The created tag.
 */
export const createTag = async (req: TagUpsertRequest): Promise<Tag> => {
    const response = await apiRequest<ItemEnvelope<Tag>, TagUpsertRequest>({
        auth: true,
        body: req,
        method: "POST",
        path: "/api/v1/backoffice/tags",
    });

    return response.item;
};

/**
 * Deletes an existing tag.
 *
 * @param tagId The tag identifier.
 */
export const deleteTag = async (tagId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/backoffice/tags/${tagId}`,
    });
};

/**
 * Lists tags assigned to a property.
 *
 * @param propertyId The property identifier.
 * @returns The tag collection.
 */
export const listPropertyTags = async (propertyId: string): Promise<Tag[]> => {
    const response = await apiRequest<ListEnvelope<Tag>>({
        auth: true,
        path: `/api/v1/backoffice/properties/${propertyId}/tags`,
    });

    return response.items;
};

/**
 * Replaces the full set of tags for a property.
 *
 * @param propertyId The property identifier.
 * @param tagIds Array of tag identifiers to assign.
 */
export const setPropertyTags = async (propertyId: string, tagIds: string[]): Promise<void> => {
    await apiRequest<StatusEnvelope, { tag_ids: string[] }>({
        auth: true,
        body: { tag_ids: tagIds },
        method: "PUT",
        path: `/api/v1/backoffice/properties/${propertyId}/tags`,
    });
};

