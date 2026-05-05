/**
 * File: app/src/features/properties/propertyCompare.ts
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
 * - Imports: @/services/properties/properties.types, @/services/tags/tags.types
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - @/services/properties/properties.types
 * - @/services/tags/tags.types
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
import type { Tag } from "@/services/tags/tags.types";

/**
 * Documents the SavedComparison type contract used by app/src/features/properties/propertyCompare.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface SavedComparison {
    readonly createdAt: string;
    readonly id: string;
    readonly name: string;
    readonly propertyIds: readonly string[];
}

/**
 * Documents the ComparablePropertyCard type contract used by app/src/features/properties/propertyCompare.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface ComparablePropertyCard {
    readonly acquisitionNotes: string;
    readonly businessStage: string;
    readonly dealThesis: string;
    readonly id: string;
    readonly label: string;
    readonly latestChange: string;
    readonly location: string;
    readonly price?: number;
    readonly pricePerSquareMeter?: number;
    readonly propertyType: string;
    readonly rooms: string;
    readonly status: string;
    readonly tags: readonly string[];
    readonly url: string;
}

/**
 * Documents the SAVED_COMPARISONS_STORAGE_KEY module export for app/src/features/properties/propertyCompare.ts.
 * Consumers should treat this export as part of the file contract and update related docs when behavior changes.
 */
export const SAVED_COMPARISONS_STORAGE_KEY = "nido.saved-comparisons";
/**
 * Documents the MAX_COMPARISON_PROPERTIES module export for app/src/features/properties/propertyCompare.ts.
 * Consumers should treat this export as part of the file contract and update related docs when behavior changes.
 */
export const MAX_COMPARISON_PROPERTIES = 4;
/**
 * Documents the MIN_COMPARISON_PROPERTIES module export for app/src/features/properties/propertyCompare.ts.
 * Consumers should treat this export as part of the file contract and update related docs when behavior changes.
 */
export const MIN_COMPARISON_PROPERTIES = 2;

/**
 * Purpose: Executes the parseComparisonIds operation for app/src/features/properties/propertyCompare.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const parseComparisonIds = (raw: string | null): string[] => {
    if (raw === null) {
        return [];
    }

    return Array.from(new Set(raw.split(",").map((item) => item.trim()).filter((item) => item !== ""))).slice(0, MAX_COMPARISON_PROPERTIES);
};

/**
 * Purpose: Executes the stringifyComparisonIds operation for app/src/features/properties/propertyCompare.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const stringifyComparisonIds = (ids: readonly string[]): string => ids.join(",");

/**
 * Purpose: Executes the readSavedComparisons operation for app/src/features/properties/propertyCompare.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const readSavedComparisons = (): SavedComparison[] => {
    if (typeof window === "undefined") {
        return [];
    }

    try {
        const parsed = JSON.parse(window.localStorage.getItem(SAVED_COMPARISONS_STORAGE_KEY) ?? "[]") as SavedComparison[];
        return Array.isArray(parsed)
            ? parsed.filter((item) => typeof item?.id === "string" && typeof item?.name === "string" && Array.isArray(item?.propertyIds))
            : [];
    } catch {
        return [];
    }
};

/**
 * Purpose: Executes the writeSavedComparisons operation for app/src/features/properties/propertyCompare.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const writeSavedComparisons = (items: readonly SavedComparison[]): void => {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(SAVED_COMPARISONS_STORAGE_KEY, JSON.stringify(items));
};

const readNumber = (summary: PropertySummary | undefined, keys: readonly string[]): number | undefined => {
    for (const key of keys) {
        const raw = summary?.current_values[key];
        if (raw === undefined) {
            continue;
        }

        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return undefined;
};

const readText = (summary: PropertySummary | undefined, keys: readonly string[]): string => {
    for (const key of keys) {
        const raw = summary?.current_values[key]?.trim();
        if (raw !== undefined && raw !== "") {
            return raw;
        }
    }

    return "—";
};

/**
 * Purpose: Executes the buildComparablePropertyCard operation for app/src/features/properties/propertyCompare.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const buildComparablePropertyCard = (
    summary: PropertySummary,
    tags: readonly Tag[],
): ComparablePropertyCard => ({
    acquisitionNotes: summary.property.metadata?.acquisition_notes?.trim() ?? "—",
    businessStage: summary.property.metadata?.business_stage?.trim() ?? "—",
    dealThesis: summary.property.metadata?.deal_thesis?.trim() ?? "—",
    id: summary.property.id,
    label: summary.property.label.trim() || summary.property.url.trim() || "Manual property",
    latestChange: summary.latest_change_summary.trim() || "No recent change",
    location: readText(summary, ["location", "district", "city"]),
    price: summary.decision.current_price ?? readNumber(summary, ["price", "total_price"]),
    pricePerSquareMeter: summary.decision.current_price_per_sqm ?? readNumber(summary, ["price_per_sqm", "price_per_square_meter"]),
    propertyType: readText(summary, ["property_type", "type"]),
    rooms: readText(summary, ["rooms", "bedrooms"]),
    status: summary.property.status,
    tags: tags.map((tag) => tag.name),
    url: summary.property.url,
});
