import type { PropertySummary } from "@/services/properties/properties.types";

interface OpportunityBreakdown {
    readonly bathrooms: number;
    readonly price: number;
    readonly pricePerSquareMeter: number;
    readonly propertyAge: number;
    readonly rooms: number;
}

export interface OpportunityCandidate {
    readonly bathrooms?: number;
    readonly breakdown: OpportunityBreakdown;
    readonly deltaAbsolute?: number;
    readonly deltaPercent?: number;
    readonly label: string;
    readonly price?: number;
    readonly pricePerSquareMeter?: number;
    readonly propertyAge?: number;
    readonly propertyId: string;
    readonly rooms?: number;
    readonly score: number;
}

export interface PriceChangeItem {
    readonly deltaAbsolute: number;
    readonly deltaPercent?: number;
    readonly label: string;
    readonly observedAt: string;
    readonly propertyId: string;
}

export interface PortfolioDashboardModel {
    readonly averagePrice: number;
    readonly medianPrice: number;
    readonly priceBucketCounts: readonly { readonly count: number; readonly label: string; }[];
    readonly priceChanges: readonly PriceChangeItem[];
    readonly priceDistribution: readonly number[];
    readonly priceMovement: {
        readonly decreases: number;
        readonly increases: number;
        readonly netDelta: number;
        readonly stagnant: number;
    };
    readonly recentUpdateCount: number;
    readonly stagnantCount: number;
    readonly topOpportunities: readonly OpportunityCandidate[];
    readonly totalProperties: number;
}

const OPPORTUNITY_WEIGHTS = {
    bathrooms: 0.10,
    price: 0.45,
    pricePerSquareMeter: 0.25,
    propertyAge: 0.05,
    rooms: 0.15,
} as const;

export const buildPortfolioDashboardModel = (summaries: readonly PropertySummary[]): PortfolioDashboardModel => {
    const enriched = summaries.map((summary) => {
        const price = readNumber(summary, ["price", "total_price"]);
        const area = readNumber(summary, ["area_m2", "surface_area", "area"]);
        const rooms = readNumber(summary, ["rooms", "bedrooms"]);
        const bathrooms = readNumber(summary, ["bathrooms"]);
        const propertyAge = readNumber(summary, ["property_age"]);
        const pricePerSquareMeter = summary.decision.current_price_per_sqm ?? (price !== undefined && area !== undefined && area > 0 ? price / area : undefined);
        const priceSignal = summary.signals.find((signal) => signal.field === "price");
        return {
            bathrooms,
            label: summary.property.label.trim() !== "" ? summary.property.label : summary.property.url.trim() !== "" ? summary.property.url : "Manual property",
            price,
            priceChange: priceSignal === undefined ? undefined : {
                deltaAbsolute: priceSignal.absolute_delta ?? 0,
                deltaPercent: priceSignal.percent_delta,
                observedAt: priceSignal.observed_at,
            },
            pricePerSquareMeter,
            propertyAge,
            propertyId: summary.property.id,
            rooms,
        };
    });

    const prices = enriched.map((item) => item.price).filter((value): value is number => value !== undefined).sort((left, right) => left - right);
    const priceMovement = enriched.reduce((accumulator, item) => {
        if (item.priceChange === undefined || item.priceChange.deltaAbsolute === 0) {
            return { ...accumulator, stagnant: accumulator.stagnant + 1 };
        }
        if (item.priceChange.deltaAbsolute > 0) {
            return {
                ...accumulator,
                increases: accumulator.increases + 1,
                netDelta: accumulator.netDelta + item.priceChange.deltaAbsolute,
            };
        }

        return {
            ...accumulator,
            decreases: accumulator.decreases + 1,
            netDelta: accumulator.netDelta + item.priceChange.deltaAbsolute,
        };
    }, { decreases: 0, increases: 0, netDelta: 0, stagnant: 0 });

    const priceChanges = enriched
        .filter((item): item is typeof item & { readonly priceChange: NonNullable<typeof item.priceChange>; } => item.priceChange !== undefined)
        .sort((left, right) => Date.parse(right.priceChange.observedAt) - Date.parse(left.priceChange.observedAt))
        .map((item) => ({
            deltaAbsolute: item.priceChange.deltaAbsolute,
            deltaPercent: item.priceChange.deltaPercent,
            label: item.label,
            observedAt: item.priceChange.observedAt,
            propertyId: item.propertyId,
        }));

    return {
        averagePrice: prices.length === 0 ? 0 : prices.reduce((sum, value) => sum + value, 0) / prices.length,
        medianPrice: computeMedian(prices),
        priceBucketCounts: buildPriceBuckets(prices),
        priceChanges,
        priceDistribution: prices,
        priceMovement,
        recentUpdateCount: priceChanges.length,
        stagnantCount: Math.max(summaries.length - priceChanges.length, 0),
        topOpportunities: rankOpportunities(enriched).slice(0, 5),
        totalProperties: summaries.length,
    };
};

const rankOpportunities = (
    items: readonly {
        readonly bathrooms?: number;
        readonly label: string;
        readonly price?: number;
        readonly priceChange?: {
            readonly deltaAbsolute: number;
            readonly deltaPercent?: number;
        };
        readonly pricePerSquareMeter?: number;
        readonly propertyAge?: number;
        readonly propertyId: string;
        readonly rooms?: number;
    }[],
): OpportunityCandidate[] => {
    const ranges = {
        bathrooms: rangeOf(items.map((item) => item.bathrooms)),
        price: rangeOf(items.map((item) => item.price)),
        pricePerSquareMeter: rangeOf(items.map((item) => item.pricePerSquareMeter)),
        propertyAge: rangeOf(items.map((item) => item.propertyAge)),
        rooms: rangeOf(items.map((item) => item.rooms)),
    };

    return items
        .filter((item) => item.price !== undefined)
        .map((item) => {
            const breakdown = {
                bathrooms: scoreHigherIsBetter(item.bathrooms, ranges.bathrooms),
                price: scoreLowerIsBetter(item.price, ranges.price),
                pricePerSquareMeter: scoreLowerIsBetter(item.pricePerSquareMeter, ranges.pricePerSquareMeter),
                propertyAge: scoreLowerIsBetter(item.propertyAge, ranges.propertyAge),
                rooms: scoreHigherIsBetter(item.rooms, ranges.rooms),
            };
            const availableWeights = [
                item.price !== undefined ? OPPORTUNITY_WEIGHTS.price : 0,
                item.pricePerSquareMeter !== undefined ? OPPORTUNITY_WEIGHTS.pricePerSquareMeter : 0,
                item.rooms !== undefined ? OPPORTUNITY_WEIGHTS.rooms : 0,
                item.bathrooms !== undefined ? OPPORTUNITY_WEIGHTS.bathrooms : 0,
                item.propertyAge !== undefined ? OPPORTUNITY_WEIGHTS.propertyAge : 0,
            ].reduce((sum, value) => sum + value, 0);
            const weightedScore = (
                breakdown.price * OPPORTUNITY_WEIGHTS.price
                + breakdown.pricePerSquareMeter * OPPORTUNITY_WEIGHTS.pricePerSquareMeter
                + breakdown.rooms * OPPORTUNITY_WEIGHTS.rooms
                + breakdown.bathrooms * OPPORTUNITY_WEIGHTS.bathrooms
                + breakdown.propertyAge * OPPORTUNITY_WEIGHTS.propertyAge
            ) / Math.max(availableWeights, 1);

            return {
                bathrooms: item.bathrooms,
                breakdown,
                deltaAbsolute: item.priceChange?.deltaAbsolute,
                deltaPercent: item.priceChange?.deltaPercent,
                label: item.label,
                price: item.price,
                pricePerSquareMeter: item.pricePerSquareMeter,
                propertyAge: item.propertyAge,
                propertyId: item.propertyId,
                rooms: item.rooms,
                score: Math.round(weightedScore * 100),
            };
        })
        .sort((left, right) => right.score - left.score || (left.price ?? 0) - (right.price ?? 0));
};

const buildPriceBuckets = (prices: readonly number[]): readonly { readonly count: number; readonly label: string; }[] => {
    if (prices.length === 0) {
        return [];
    }

    const minimum = prices[0] ?? 0;
    const maximum = prices[prices.length - 1] ?? minimum;
    if (minimum === maximum) {
        return [{ count: prices.length, label: formatBucketLabel(minimum, maximum) }];
    }

    const step = Math.max((maximum - minimum) / 4, 1);
    return Array.from({ length: 4 }, (_, index) => {
        const bucketMin = minimum + (step * index);
        const bucketMax = index === 3 ? maximum : minimum + (step * (index + 1));
        return {
            count: prices.filter((price) => price >= bucketMin && (index === 3 ? price <= bucketMax : price < bucketMax)).length,
            label: formatBucketLabel(bucketMin, bucketMax),
        };
    });
};

const computeMedian = (values: readonly number[]): number => {
    if (values.length === 0) {
        return 0;
    }
    const midpoint = Math.floor(values.length / 2);
    if (values.length % 2 === 1) {
        return values[midpoint] ?? 0;
    }

    return ((values[midpoint - 1] ?? 0) + (values[midpoint] ?? 0)) / 2;
};

const readNumber = (summary: PropertySummary, keys: readonly string[]): number | undefined => {
    for (const key of keys) {
        const raw = summary.current_values[key];
        if (raw === undefined) {
            continue;
        }
        const parsed = Number(raw.replace(/[^0-9.,-]/g, "").replace(/,/g, "."));
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
};

const rangeOf = (values: readonly (number | undefined)[]): { readonly max: number; readonly min: number; } => {
    const defined = values.filter((value): value is number => value !== undefined);
    if (defined.length === 0) {
        return { max: 0, min: 0 };
    }

    return {
        max: Math.max(...defined),
        min: Math.min(...defined),
    };
};

const scoreLowerIsBetter = (value: number | undefined, range: { readonly max: number; readonly min: number; }): number => {
    if (value === undefined || range.max === range.min) {
        return 1;
    }

    return 1 - ((value - range.min) / (range.max - range.min));
};

const scoreHigherIsBetter = (value: number | undefined, range: { readonly max: number; readonly min: number; }): number => {
    if (value === undefined || range.max === range.min) {
        return 1;
    }

    return (value - range.min) / (range.max - range.min);
};

const formatBucketLabel = (minimum: number, maximum: number): string => {
    return `${Math.round(minimum / 1000)}k-${Math.round(maximum / 1000)}k`;
};
