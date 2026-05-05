/**
 * File: app/src/services/alert-rules/alert-rules.service.ts
 *
 * Purpose:
 * Defines the alert-rules frontend API contract, request helpers, query keys, or shared service types.
 *
 * Responsibilities:
 * - Describe typed request and response boundaries
 * - Centralize API paths, query keys, or service helpers
 * - Keep backend integration details out of rendering components
 *
 * Inputs:
 * - Imports: @/lib/api/client, @/services/alert-rules/alert-rules.types
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
 *
 * Dependencies:
 * - @/lib/api/client
 * - @/services/alert-rules/alert-rules.types
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

import type { AlertRule, CreateAlertRuleRequest } from "@/services/alert-rules/alert-rules.types";

/**
 * Loads all alert rules for the current user.
 *
 * @returns The alert-rule collection.
 */
export const listAlertRules = async (): Promise<AlertRule[]> => {
    const response = await apiRequest<ListEnvelope<AlertRule>>({
        auth: true,
        path: "/api/v1/me/alert-rules",
    });

    return response.items;
};

/**
 * Creates one alert rule.
 *
 * @param request The alert-rule request body.
 * @returns The stored alert rule.
 */
export const createAlertRule = async (request: CreateAlertRuleRequest): Promise<AlertRule> => {
    const response = await apiRequest<ItemEnvelope<AlertRule>, CreateAlertRuleRequest>({
        auth: true,
        body: request,
        method: "POST",
        path: "/api/v1/me/alert-rules",
    });

    return response.item;
};

/**
 * Updates the enabled state for one alert rule.
 *
 * @param ruleId The alert-rule identifier.
 * @param enabled Whether the rule should be enabled.
 */
export const setAlertRuleEnabled = async (ruleId: string, enabled: boolean): Promise<void> => {
    await apiRequest<StatusEnvelope, { enabled: boolean }>({
        auth: true,
        body: { enabled },
        method: "PUT",
        path: `/api/v1/me/alert-rules/${ruleId}`,
    });
};

/**
 * Deletes one alert rule.
 *
 * @param ruleId The alert-rule identifier to delete.
 */
export const deleteAlertRule = async (ruleId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/me/alert-rules/${ruleId}`,
    });
};
