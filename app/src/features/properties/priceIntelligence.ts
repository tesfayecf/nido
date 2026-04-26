import type { PropertySummary } from "@/services/properties/properties.types";

import { parseNumeric } from "@/features/analytics/analytics.utils";
import type { WorkspaceSettings } from "@/features/settings/workspaceSettings";
import { DEFAULT_WORKSPACE_SETTINGS } from "@/features/settings/workspaceSettings";

export type PriceClassification = "cheap" | "expensive" | "fair";

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

const parseValue = (value: string | undefined): number | undefined => {
    return value !== undefined ? parseNumeric(value) : undefined;
};

const readMappedNumber = (values: Record<string, string>, candidates: readonly string[]): number | undefined => {
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

const buildComparableSet = (summary: PropertySummary, settings: WorkspaceSettings): Set<string> => {
    return new Set(buildComparableTokens(summary.current_values, settings.field_mappings.comparable_fields));
};

const readCurrentPrice = (summary: PropertySummary, settings: WorkspaceSettings): number | undefined => {
    return summary.decision.current_price
        ?? readMappedNumber(summary.current_values, settings.field_mappings.price_fields);
};

const readPricePerUnit = (summary: PropertySummary, settings: WorkspaceSettings): number | undefined => {
    return summary.decision.current_price_per_sqm
        ?? readMappedNumber(summary.current_values, ["price_per_m2", "price_per_sqm", "eur_m2"])
        ?? (() => {
            const price = readCurrentPrice(summary, settings);
            const area = readMappedNumber(summary.current_values, settings.field_mappings.area_fields);
            if (price === undefined || area === undefined || area < 0.01) {
                return undefined;
            }

            return price / area;
        })();
};

const buildComparableCandidates = (
    summary: PropertySummary,
    summaries: readonly PropertySummary[],
    settings: WorkspaceSettings,
): PropertySummary[] => {
    const comparableTokens = buildComparableSet(summary, settings);
    const allOthers = summaries.filter((item) => item.property.id !== summary.property.id && readCurrentPrice(item, settings) !== undefined);
    if (comparableTokens.size === 0) {
        return allOthers;
    }

    const matches = allOthers.filter((item) => {
        const candidateTokens = buildComparableSet(item, settings);
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

export const buildPriceIntelligence = (
    summary: PropertySummary,
    summaries: readonly PropertySummary[],
    settings: WorkspaceSettings = DEFAULT_WORKSPACE_SETTINGS,
): PriceIntelligence => {
    const currentPrice = readCurrentPrice(summary, settings);
    const targetPrice = summary.decision.target_price ?? summary.property.metadata?.target_price;
    const comparableSummaries = buildComparableCandidates(summary, summaries, settings);
    const comparablePrices = comparableSummaries
        .map((item) => readCurrentPrice(item, settings))
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
        current_price_per_unit: readPricePerUnit(summary, settings),
        market_average: marketAverage,
        market_delta_absolute: marketDeltaAbsolute,
        market_delta_percent: marketDeltaPercent,
        target_delta_absolute: targetDeltaAbsolute,
        target_delta_percent: targetDeltaPercent,
        target_price: targetPrice,
    };
};

export const formatDecisionStatus = (value: string | undefined): string => {
    if (value === undefined || value.trim() === "") {
        return "Unspecified";
    }

    return value.replace(/_/gu, " ");
};
