/**
 * File: app/src/services/bookmarks/bookmarks.service.ts
 *
 * Purpose:
 * Defines the bookmarks frontend API contract, request helpers, query keys, or shared service types.
 *
 * Responsibilities:
 * - Describe typed request and response boundaries
 * - Centralize API paths, query keys, or service helpers
 * - Keep backend integration details out of rendering components
 *
 * Inputs:
 * - Imports: @/lib/api/client, @/services/bookmarks/bookmarks.types
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
 *
 * Dependencies:
 * - @/lib/api/client
 * - @/services/bookmarks/bookmarks.types
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
import { apiRequest, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";

import type { BookmarkedProperty } from "@/services/bookmarks/bookmarks.types";

/**
 * Purpose: Executes the listBookmarks operation for app/src/services/bookmarks/bookmarks.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const listBookmarks = async (): Promise<BookmarkedProperty[]> => {
    const response = await apiRequest<ListEnvelope<BookmarkedProperty>>({
        auth: true,
        path: "/api/v1/me/bookmarks",
    });

    return response.items;
};

/**
 * Purpose: Executes the createBookmark operation for app/src/services/bookmarks/bookmarks.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const createBookmark = async (propertyId: string): Promise<void> => {
    await apiRequest<StatusEnvelope, { property_id: string; }>({
        auth: true,
        body: { property_id: propertyId },
        method: "POST",
        path: "/api/v1/me/bookmarks",
    });
};

/**
 * Purpose: Executes the deleteBookmark operation for app/src/services/bookmarks/bookmarks.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const deleteBookmark = async (propertyId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/me/bookmarks/${propertyId}`,
    });
};
