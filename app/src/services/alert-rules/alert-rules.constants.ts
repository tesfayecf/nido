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
];

const lookup = new Map(ALERT_RULE_TYPES.map((option) => [option.value, option]));

export const getRuleTypeLabel = (value: string): string => {
    return lookup.get(value)?.description ?? value;
};

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

export const ruleRequiresThreshold = (value: string): boolean => {
    return lookup.get(value)?.requiresThreshold ?? false;
};
