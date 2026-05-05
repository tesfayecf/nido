/**
 * File: app/src/services/backoffice-sources/sources.service.ts
 *
 * Purpose:
 * Defines the backoffice-sources frontend API contract, request helpers, query keys, or shared service types.
 *
 * Responsibilities:
 * - Describe typed request and response boundaries
 * - Centralize API paths, query keys, or service helpers
 * - Keep backend integration details out of rendering components
 *
 * Inputs:
 * - Imports: @/lib/api/client, @/services/backoffice-sources/sources.types
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
 *
 * Dependencies:
 * - @/lib/api/client
 * - @/services/backoffice-sources/sources.types
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

import type { Source } from "@/services/backoffice-sources/sources.types";

/**
 * Purpose: Executes the listSources operation for app/src/services/backoffice-sources/sources.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const listSources = async (): Promise<Source[]> => {
    const response = await apiRequest<ListEnvelope<Source>>({
        auth: true,
        path: "/api/v1/backoffice/sources",
    });

    return response.items;
};

/**
 * Purpose: Executes the getSource operation for app/src/services/backoffice-sources/sources.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const getSource = async (sourceId: string): Promise<Source> => {
    const response = await apiRequest<ItemEnvelope<Source>>({
        auth: true,
        path: `/api/v1/backoffice/sources/${sourceId}`,
    });

    return response.item;
};

/**
 * Purpose: Executes the upsertSource operation for app/src/services/backoffice-sources/sources.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const upsertSource = async (source: Source): Promise<Source> => {
    const response = await apiRequest<ItemEnvelope<Source>, Source>({
        auth: true,
        body: source,
        method: "POST",
        path: "/api/v1/backoffice/sources",
    });

    return response.item;
};

/**
 * Purpose: Executes the deleteSource operation for app/src/services/backoffice-sources/sources.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const deleteSource = async (sourceId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/backoffice/sources/${sourceId}`,
    });
};
