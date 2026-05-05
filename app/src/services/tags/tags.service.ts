/**
 * File: app/src/services/tags/tags.service.ts
 *
 * Purpose:
 * Defines the tags frontend API contract, request helpers, query keys, or shared service types.
 *
 * Responsibilities:
 * - Describe typed request and response boundaries
 * - Centralize API paths, query keys, or service helpers
 * - Keep backend integration details out of rendering components
 *
 * Inputs:
 * - Imports: @/lib/api/client, @/services/tags/tags.types
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
 *
 * Dependencies:
 * - @/lib/api/client
 * - @/services/tags/tags.types
 *
 * Key Decisions:
 * - Keeps documentation adjacent to the implementation so future changes update behavior and context together.
 * - Uses explicit imports and typed boundaries to make ownership traceable from this file in isolation.
 *
 * Constraints:
 * - Documentation must remain synchronized with behavior, tests, and related docs when this file changes.
 * - Runtime behavior must not depend on comments or documentation-only metadata.
 *
 * Related:
 * - /docs/frontend/documentation-template.md
 * - /docs/frontend/architecture-overview.md#api-contracts
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
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

