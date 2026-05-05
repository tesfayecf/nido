/**
 * File: app/src/services/fields/fields.service.ts
 *
 * Purpose:
 * Defines the fields frontend API contract, request helpers, query keys, or shared service types.
 *
 * Responsibilities:
 * - Describe typed request and response boundaries
 * - Centralize API paths, query keys, or service helpers
 * - Keep backend integration details out of rendering components
 *
 * Inputs:
 * - Imports: @/lib/api/client, @/services/fields/fields.types
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
 *
 * Dependencies:
 * - @/lib/api/client
 * - @/services/fields/fields.types
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

import type { FieldDefinition, FieldDefinitionUsage } from "@/services/fields/fields.types";

/**
 * Purpose: Executes the listFields operation for app/src/services/fields/fields.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const listFields = async (): Promise<FieldDefinitionUsage[]> => {
    const response = await apiRequest<ListEnvelope<FieldDefinitionUsage>>({
        auth: true,
        path: "/api/v1/backoffice/fields",
    });
    return response.items;
};

/**
 * Purpose: Executes the createField operation for app/src/services/fields/fields.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const createField = async (request: Omit<FieldDefinition, "created_at" | "id" | "system_defined" | "updated_at">): Promise<FieldDefinition> => {
    const response = await apiRequest<ItemEnvelope<FieldDefinition>, typeof request>({
        auth: true,
        body: request,
        method: "POST",
        path: "/api/v1/backoffice/fields",
    });
    return response.item;
};

/**
 * Purpose: Executes the updateField operation for app/src/services/fields/fields.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const updateField = async (fieldId: string, request: Partial<FieldDefinition>): Promise<FieldDefinition> => {
    const response = await apiRequest<ItemEnvelope<FieldDefinition>, Partial<FieldDefinition>>({
        auth: true,
        body: request,
        method: "PUT",
        path: `/api/v1/backoffice/fields/${fieldId}`,
    });
    return response.item;
};

/**
 * Purpose: Executes the deleteField operation for app/src/services/fields/fields.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const deleteField = async (fieldId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/backoffice/fields/${fieldId}`,
    });
};
