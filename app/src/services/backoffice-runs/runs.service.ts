/**
 * File: app/src/services/backoffice-runs/runs.service.ts
 *
 * Purpose:
 * Defines the backoffice-runs frontend API contract, request helpers, query keys, or shared service types.
 *
 * Responsibilities:
 * - Describe typed request and response boundaries
 * - Centralize API paths, query keys, or service helpers
 * - Keep backend integration details out of rendering components
 *
 * Inputs:
 * - Imports: @/lib/api/client, @/services/backoffice-runs/runs.types
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
 *
 * Dependencies:
 * - @/lib/api/client
 * - @/services/backoffice-runs/runs.types
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

import type { Run, RunFilters } from "@/services/backoffice-runs/runs.types";

/**
 * Purpose: Executes the listRuns operation for app/src/services/backoffice-runs/runs.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const listRuns = async (filters: RunFilters): Promise<ListEnvelope<Run>> => {
    const params = new URLSearchParams();
    if (filters.property_id.trim() !== "") {
        params.set("property_id", filters.property_id.trim());
    }

    params.set("limit", `${filters.limit}`);

    return apiRequest<ListEnvelope<Run>>({
        auth: true,
        path: `/api/v1/backoffice/runs?${params.toString()}`,
    });
};

/**
 * Purpose: Executes the getRun operation for app/src/services/backoffice-runs/runs.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const getRun = async (runId: string): Promise<Run> => {
    const response = await apiRequest<ItemEnvelope<Run>>({
        auth: true,
        path: `/api/v1/backoffice/runs/${runId}`,
    });

    return response.item;
};

/**
 * Purpose: Executes the deleteRun operation for app/src/services/backoffice-runs/runs.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const deleteRun = async (runId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/backoffice/runs/${runId}`,
    });
};
