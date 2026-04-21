import type { Listing, PriceEvent } from "@/services/listings/listings.types";

/**
 * Enumerates the supported listing sort orders.
 */
export type ListingSortOrder = "latest" | "price-asc" | "price-desc" | "value";

/**
 * Describes the client-side filter controls supported by the market explorer.
 */
export interface PropertyFilters {
    readonly limit: number;
    readonly maxPrice: number | null;
    readonly minPrice: number | null;
    readonly onlyValue: boolean;
    readonly q: string;
    readonly sort: ListingSortOrder;
    readonly sourceId: string;
}

/**
 * Summarizes pricing across a listing slice.
 */
export interface ListingSummary {
    readonly average: number | null;
    readonly currency: string;
    readonly max: number | null;
    readonly min: number | null;
}

/**
 * Describes regional benchmark data derived from the visible result set.
 */
export interface RegionBenchmark {
    readonly averagePrice: number;
    readonly count: number;
    readonly key: string;
    readonly label: string;
    readonly sparkline: number[];
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Calculates top-level pricing summary values.
 *
 * @param items The listings visible in the current market slice.
 * @returns Aggregate pricing summary information.
 */
export const summarizeListings = (items: Listing[]): ListingSummary => {
    const [firstItem, ...remainingItems] = items;

    if (firstItem === undefined) {
        return { average: null, currency: "EUR", max: null, min: null };
    }

    let total = firstItem.price_amount;
    let min = firstItem.price_amount;
    let max = firstItem.price_amount;

    for (const item of remainingItems) {
        total += item.price_amount;
        min = Math.min(min, item.price_amount);
        max = Math.max(max, item.price_amount);
    }

    return {
        average: Math.round(total / items.length),
        currency: firstItem.currency,
        max,
        min,
    };
};

/**
 * Filters and sorts listings on the client for URL-backed controls that the
 * current backend does not expose yet.
 *
 * @param items The raw listings returned by the backend.
 * @param filters The active property filters.
 * @returns The filtered and sorted listing slice.
 */
export const filterAndSortListings = (items: Listing[], filters: PropertyFilters): Listing[] => {
    const benchmarks = buildRegionBenchmarks(items);
    const filteredItems = items.filter((item) => {
        if (filters.minPrice !== null && item.price_amount < filters.minPrice) {
            return false;
        }

        if (filters.maxPrice !== null && item.price_amount > filters.maxPrice) {
            return false;
        }

        if (!filters.onlyValue) {
            return true;
        }

        return isValueListing(item, benchmarks);
    });

    return filteredItems.slice().sort((left: Listing, right: Listing) => {
        switch (filters.sort) {
            case "price-asc":
                return left.price_amount - right.price_amount;
            case "price-desc":
                return right.price_amount - left.price_amount;
            case "value": {
                const leftScore = priceDeltaRatio(left, benchmarks);
                const rightScore = priceDeltaRatio(right, benchmarks);
                if (leftScore !== rightScore) {
                    return leftScore - rightScore;
                }

                return right.last_seen_at.localeCompare(left.last_seen_at);
            }

            case "latest":
            default:
                return right.last_seen_at.localeCompare(left.last_seen_at);
        }
    });
};

/**
 * Builds regional benchmark statistics from the visible listings.
 *
 * @param items The visible listings.
 * @returns A benchmark map keyed by normalized location.
 */
export const buildRegionBenchmarks = (items: Listing[]): Map<string, RegionBenchmark> => {
    const groups = new Map<string, Listing[]>();

    for (const item of items) {
        const key = normalizeLocation(item.location);
        const existing = groups.get(key);
        if (existing === undefined) {
            groups.set(key, [item]);
            continue;
        }

        existing.push(item);
    }

    return new Map(
        Array.from(groups.entries()).map(([key, group]) => {
            const averagePrice = Math.round(group.reduce((sum, item) => sum + item.price_amount, 0) / group.length);
            const sparkline = group
                .slice()
                .sort((left: Listing, right: Listing) => left.last_seen_at.localeCompare(right.last_seen_at))
                .map((item: Listing) => item.price_amount);

            return [
                key,
                {
                    averagePrice,
                    count: group.length,
                    key,
                    label: group[0]?.location.trim() === "" ? "Unknown market" : group[0]?.location ?? "Unknown market",
                    sparkline,
                },
            ];
        }),
    );
};

/**
 * Approximates days on market using first and latest snapshot timestamps.
 *
 * @param item The listing to inspect.
 * @returns The rounded day count.
 */
export const getDaysOnMarket = (item: Listing): number => {
    const start = Date.parse(item.first_seen_at);
    const end = Date.parse(item.latest_snapshot_at || item.last_seen_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return 0;
    }

    return Math.max(0, Math.round((end - start) / MS_PER_DAY));
};

/**
 * Calculates how far below or above the regional average a listing is.
 *
 * @param item The listing to inspect.
 * @param benchmarks The regional benchmark table.
 * @returns A ratio relative to the regional average.
 */
export const priceDeltaRatio = (item: Listing, benchmarks: Map<string, RegionBenchmark>): number => {
    const benchmark = benchmarks.get(normalizeLocation(item.location));
    if (benchmark === undefined || benchmark.averagePrice <= 0) {
        return 0;
    }

    return (item.price_amount - benchmark.averagePrice) / benchmark.averagePrice;
};

/**
 * Determines whether a listing qualifies as a value opportunity.
 *
 * @param item The listing to inspect.
 * @param benchmarks The regional benchmark table.
 * @returns True when the listing is at least 20% below its regional average.
 */
export const isValueListing = (item: Listing, benchmarks: Map<string, RegionBenchmark>): boolean => {
    return priceDeltaRatio(item, benchmarks) <= -0.2;
};

/**
 * Converts a sequence of numbers into SVG sparkline points.
 *
 * @param values The numeric series to render.
 * @returns A point string for an SVG polyline.
 */
export const buildSparklinePoints = (values: number[]): string => {
    if (values.length === 0) {
        return "";
    }

    if (values.length === 1) {
        return "0,16 100,16";
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);

    return values
        .map((value, index) => {
            const x = (index / (values.length - 1)) * 100;
            const y = 28 - (((value - min) / range) * 24 + 2);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");
};

/**
 * Builds a compact sparkline series from price-history events.
 *
 * @param history The historical price events for a listing.
 * @param currentPrice The current price for the listing.
 * @returns The full numeric series ordered oldest to newest.
 */
export const buildPriceHistorySeries = (history: PriceEvent[], currentPrice: number): number[] => {
    if (history.length === 0) {
        return [currentPrice];
    }

    const ordered = history.slice().sort((left: PriceEvent, right: PriceEvent) => left.changed_at.localeCompare(right.changed_at));
    return ordered.map((event: PriceEvent) => event.new_amount);
};

const normalizeLocation = (location: string): string => {
    const trimmed = location.trim().toLowerCase();
    return trimmed === "" ? "unknown" : trimmed;
};
