/**
 * File: app/src/services/platform/platform.service.ts
 *
 * Purpose:
 * Defines the platform frontend API contract, request helpers, query keys, or shared service types.
 *
 * Responsibilities:
 * - Describe typed request and response boundaries
 * - Centralize API paths, query keys, or service helpers
 * - Keep backend integration details out of rendering components
 *
 * Inputs:
 * - Imports: @/lib/api/client, @/services/platform/platform.types
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
 *
 * Dependencies:
 * - @/lib/api/client
 * - @/services/platform/platform.types
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
import { apiRequest, type ItemEnvelope } from "@/lib/api/client";
import type { PlatformSettings } from "@/services/platform/platform.types";

/**
 * Purpose: Executes the getPlatformSettings operation for app/src/services/platform/platform.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const getPlatformSettings = async (): Promise<PlatformSettings> => {
    const response = await apiRequest<ItemEnvelope<PlatformSettings>>({
        auth: true,
        path: "/api/v1/backoffice/platform/settings",
    });

    return response.item;
};

/**
 * Purpose: Executes the updatePlatformSettings operation for app/src/services/platform/platform.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const updatePlatformSettings = async (settings: PlatformSettings): Promise<PlatformSettings> => {
    const response = await apiRequest<ItemEnvelope<PlatformSettings>, PlatformSettings>({
        auth: true,
        body: settings,
        method: "PUT",
        path: "/api/v1/backoffice/platform/settings",
    });

    return response.item;
};
