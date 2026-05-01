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
