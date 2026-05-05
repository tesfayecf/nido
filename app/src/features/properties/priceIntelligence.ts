/**
 * File: app/src/features/properties/priceIntelligence.ts
 *
 * Purpose:
 * Implements the properties feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Define typed frontend behavior for its module boundary
 * - Keep inputs and outputs explicit for maintainability
 * - Reference related modules so changes can be traced safely
 *
 * Inputs:
 * - Imports: @/services/properties/properties.types, @/features/analytics/analytics.utils, @/features/settings/workspaceSettings
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - @/services/properties/properties.types
 * - @/features/analytics/analytics.utils
 * - @/features/settings/workspaceSettings
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
 * - /app/docs/features/properties.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import type { PropertySummary } from "@/services/properties/properties.types";

import { parseNumeric } from "@/features/analytics/analytics.utils";
import type { WorkspaceSettings } from "@/features/settings/workspaceSettings";
import { DEFAULT_WORKSPACE_SETTINGS } from "@/features/settings/workspaceSettings";

/**
 * Documents the PriceClassification type contract used by app/src/features/properties/priceIntelligence.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export type PriceClassification = "cheap" | "expensive" | "fair";

/**
 * Documents the PriceIntelligence type contract used by app/src/features/properties/priceIntelligence.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PriceIntelligence {
    readonly benchmark_label: "market average" | "target price";
    readonly benchmark_value?: number;
    readonly classification: PriceClassification;
    readonly comparable_count: number;
    readonly current_price?: number;
    readonly current_price_per_unit?: number;
    readonly market_average?: number;
    readonly market_delta_absolute?: number;
    readonly market_delta_percent?: number;
    readonly target_delta_absolute?: number;
    readonly target_delta_percent?: number;
    readonly target_price?: number;
}

const AREA_FIELDS = ["area_m2", "area"] as const;
const COMPARABLE_FIELDS = ["location", "type"] as const;
const PRICE_FIELDS = ["price"] as const;

const parseValue = (value: string | undefined): number | undefined => {
    return value !== undefined ? parseNumeric(value) : undefined;
};

const readFirstNumber = (values: Record<string, string>, candidates: readonly string[]): number | undefined => {
    for (const key of candidates) {
        const parsed = parseValue(values[key]);
        if (parsed !== undefined) {
            return parsed;
        }
    }

    return undefined;
};

const buildComparableTokens = (values: Record<string, string>, fields: readonly string[]): string[] => {
    return fields
        .map((field) => {
            const raw = values[field];
            return raw !== undefined && raw.trim() !== "" ? `${field}:${raw.trim().toLowerCase()}` : undefined;
        })
        .filter((token): token is string => token !== undefined);
};

const buildComparableSet = (summary: PropertySummary): Set<string> => {
    return new Set(buildComparableTokens(summary.current_values, COMPARABLE_FIELDS));
};

const readCurrentPrice = (summary: PropertySummary): number | undefined => {
    return summary.decision.current_price
        ?? readFirstNumber(summary.current_values, PRICE_FIELDS);
};

const readPricePerUnit = (summary: PropertySummary): number | undefined => {
    return summary.decision.current_price_per_sqm
        ?? readFirstNumber(summary.current_values, ["price_per_m2", "price_per_sqm", "eur_m2"])
        ?? (() => {
            const price = readCurrentPrice(summary);
            const area = readFirstNumber(summary.current_values, AREA_FIELDS);
            if (price === undefined || area === undefined || area < 0.01) {
                return undefined;
            }

            return price / area;
        })();
};

const buildComparableCandidates = (
    summary: PropertySummary,
    summaries: readonly PropertySummary[],
): PropertySummary[] => {
    const comparableTokens = buildComparableSet(summary);
    const allOthers = summaries.filter((item) => item.property.id !== summary.property.id && readCurrentPrice(item) !== undefined);
    if (comparableTokens.size === 0) {
        return allOthers;
    }

    const matches = allOthers.filter((item) => {
        const candidateTokens = buildComparableSet(item);
        return Array.from(comparableTokens).some((token) => candidateTokens.has(token));
    });

    return matches.length > 0 ? matches : allOthers;
};

const computeDeltaPercent = (currentValue: number | undefined, referenceValue: number | undefined): number | undefined => {
    if (currentValue === undefined || referenceValue === undefined || referenceValue === 0) {
        return undefined;
    }

    return ((currentValue - referenceValue) / referenceValue) * 100;
};

const computeDeltaAbsolute = (currentValue: number | undefined, referenceValue: number | undefined): number | undefined => {
    if (currentValue === undefined || referenceValue === undefined) {
        return undefined;
    }

    return currentValue - referenceValue;
};

/**
 * Purpose: Executes the classifyPrice operation for app/src/features/properties/priceIntelligence.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const classifyPrice = (
    deltaPercent: number | undefined,
    settings: WorkspaceSettings = DEFAULT_WORKSPACE_SETTINGS,
): PriceClassification => {
    if (deltaPercent === undefined) {
        return "fair";
    }

    if (deltaPercent <= -settings.thresholds.cheap_below_percent) {
        return "cheap";
    }

    if (deltaPercent >= settings.thresholds.expensive_above_percent) {
        return "expensive";
    }

    return "fair";
};

/**
 * Purpose: Executes the buildPriceIntelligence operation for app/src/features/properties/priceIntelligence.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const buildPriceIntelligence = (
    summary: PropertySummary,
    summaries: readonly PropertySummary[],
    settings: WorkspaceSettings = DEFAULT_WORKSPACE_SETTINGS,
): PriceIntelligence => {
    const currentPrice = readCurrentPrice(summary);
    const targetPrice = summary.decision.target_price ?? summary.property.metadata?.target_price;
    const comparableSummaries = buildComparableCandidates(summary, summaries);
    const comparablePrices = comparableSummaries
        .map((item) => readCurrentPrice(item))
        .filter((value): value is number => value !== undefined);
    const marketAverage = comparablePrices.length > 0
        ? comparablePrices.reduce((sum, value) => sum + value, 0) / comparablePrices.length
        : undefined;
    const targetDeltaPercent = computeDeltaPercent(currentPrice, targetPrice);
    const targetDeltaAbsolute = computeDeltaAbsolute(currentPrice, targetPrice);
    const marketDeltaPercent = computeDeltaPercent(currentPrice, marketAverage);
    const marketDeltaAbsolute = computeDeltaAbsolute(currentPrice, marketAverage);
    const benchmarkValue = targetPrice ?? marketAverage;

    return {
        benchmark_label: targetPrice !== undefined ? "target price" : "market average",
        benchmark_value: benchmarkValue,
        classification: classifyPrice(targetDeltaPercent ?? marketDeltaPercent, settings),
        comparable_count: comparablePrices.length,
        current_price: currentPrice,
        current_price_per_unit: readPricePerUnit(summary),
        market_average: marketAverage,
        market_delta_absolute: marketDeltaAbsolute,
        market_delta_percent: marketDeltaPercent,
        target_delta_absolute: targetDeltaAbsolute,
        target_delta_percent: targetDeltaPercent,
        target_price: targetPrice,
    };
};

/**
 * Purpose: Executes the formatDecisionStatus operation for app/src/features/properties/priceIntelligence.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const formatDecisionStatus = (value: string | undefined): string => {
    if (value === undefined || value.trim() === "") {
        return "Unspecified";
    }

    return value.replace(/_/gu, " ");
};
