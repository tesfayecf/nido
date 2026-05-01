import type { PropertySnapshot } from "@/services/properties/properties.types";

export interface PriceHistoryPoint {
    readonly label: string;
    readonly observedAt: string;
    readonly value: number;
}

const NUMERIC_REGEX = /-?\d[\d.,]*/u;

export const parseSnapshotNumber = (raw: string | undefined): number | undefined => {
    if (raw === undefined) {
        return undefined;
    }

    const trimmed = raw.trim();
    if (trimmed === "") {
        return undefined;
    }

    const match = NUMERIC_REGEX.exec(trimmed);
    if (match === null) {
        return undefined;
    }

    // Normalize both "123,456.78" and "123.456,78"-style inputs into a parseable decimal string.
    const cleaned = match[0].replace(/,(?=\d{3}(?!\d))/gu, "").replace(",", ".");
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
};

export const buildPriceHistoryPoints = (snapshots: readonly PropertySnapshot[]): PriceHistoryPoint[] => {
    return snapshots
        .slice()
        .sort((left, right) => left.observed_at.localeCompare(right.observed_at))
        .map((snapshot) => {
            const value = parseSnapshotNumber(snapshot.values.price ?? snapshot.values.total_price);
            if (value === undefined) {
                return null;
            }

            return {
                label: new Date(snapshot.observed_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                }),
                observedAt: snapshot.observed_at,
                value,
            } satisfies PriceHistoryPoint;
        })
        .filter((point): point is PriceHistoryPoint => point !== null);
};
