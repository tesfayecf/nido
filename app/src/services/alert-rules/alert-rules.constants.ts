/**
 * File: app/src/services/alert-rules/alert-rules.constants.ts
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
 * - Module imports, constants, browser APIs, or caller-provided parameters as declared below
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
 *
 * Dependencies:
 * - TypeScript compiler
 * - Vite module graph
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
/**
 * Catalog of alert rule types supported by the UI. Adding a new entry here
 * keeps the AlertsPage selector and the property-level dialog in sync.
 */
export interface AlertRuleTypeOption {
    readonly description: string;
    /** Human-readable explanation in the form "When ... then trigger this alert". */
    readonly logicSummary: string;
    readonly requiresThreshold: boolean;
    readonly value: string;
}

export const ALERT_RULE_TYPES: readonly AlertRuleTypeOption[] = [
    {
        description: "Price drop",
        logicSummary: "Triggers when the latest snapshot price is lower than the previous snapshot.",
        requiresThreshold: false,
        value: "price_drop",
    },
    {
        description: "Price below threshold",
        logicSummary: "Triggers when the latest snapshot price is at or below the threshold value.",
        requiresThreshold: true,
        value: "price_below",
    },
    {
        description: "Price above threshold",
        logicSummary: "Triggers when the latest snapshot price exceeds the threshold value.",
        requiresThreshold: true,
        value: "price_above",
    },
    {
        description: "Any change",
        logicSummary: "Triggers whenever any tracked field changes between snapshots.",
        requiresThreshold: false,
        value: "any_change",
    },
    {
        description: "Significant price change",
        logicSummary: "Triggers when the price changes by 2% or more (up or down) between snapshots.",
        requiresThreshold: false,
        value: "significant_price_change",
    },
    {
        description: "Status change",
        logicSummary: "Triggers when the listing status field changes between snapshots.",
        requiresThreshold: false,
        value: "status_change",
    },
];

const lookup = new Map(ALERT_RULE_TYPES.map((option) => [option.value, option]));

/**
 * Purpose: Executes the getRuleTypeLabel operation for app/src/services/alert-rules/alert-rules.constants.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const getRuleTypeLabel = (value: string): string => {
    return lookup.get(value)?.description ?? value;
};

/**
 * Purpose: Executes the getRuleTypeLogic operation for app/src/services/alert-rules/alert-rules.constants.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const getRuleTypeLogic = (value: string, threshold?: number): string => {
    const option = lookup.get(value);
    if (option === undefined) {
        return value;
    }

    if (option.requiresThreshold && threshold !== undefined) {
        return `${option.logicSummary} Threshold: ${threshold}.`;
    }

    return option.logicSummary;
};

/**
 * Purpose: Executes the ruleRequiresThreshold operation for app/src/services/alert-rules/alert-rules.constants.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const ruleRequiresThreshold = (value: string): boolean => {
    return lookup.get(value)?.requiresThreshold ?? false;
};
