import type { PropertySummary } from "@/services/properties/properties.types";
import type { Tag } from "@/services/tags/tags.types";

export interface SavedComparison {
    readonly createdAt: string;
    readonly id: string;
    readonly name: string;
    readonly propertyIds: readonly string[];
}

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

export const SAVED_COMPARISONS_STORAGE_KEY = "nido.saved-comparisons";
export const MAX_COMPARISON_PROPERTIES = 4;
export const MIN_COMPARISON_PROPERTIES = 2;

export const parseComparisonIds = (raw: string | null): string[] => {
    if (raw === null) {
        return [];
    }

    return Array.from(new Set(raw.split(",").map((item) => item.trim()).filter((item) => item !== ""))).slice(0, MAX_COMPARISON_PROPERTIES);
};

export const stringifyComparisonIds = (ids: readonly string[]): string => ids.join(",");

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
