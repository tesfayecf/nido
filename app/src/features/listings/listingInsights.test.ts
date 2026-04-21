import { describe, expect, it } from "vitest";

import type { Listing } from "@/services/listings/listings.types";
import { buildRegionBenchmarks, buildSparklinePoints, filterAndSortListings, getDaysOnMarket, isValueListing } from "@/features/listings/listingInsights";

const listing = (overrides: Partial<Listing>): Listing => ({
    currency: "EUR",
    external_id: "ext",
    first_seen_at: "2026-04-01T00:00:00.000Z",
    id: overrides.id ?? crypto.randomUUID(),
    last_seen_at: "2026-04-20T00:00:00.000Z",
    latest_snapshot_at: "2026-04-20T00:00:00.000Z",
    location: "Girona Centre",
    price_amount: 200000,
    source_id: "bootstrap-feed",
    title: "Sample property",
    url: "https://example.com/listing",
    ...overrides,
});

describe("listing insights", () => {
    it("filters to value listings and sorts by best discount first", () => {
        const items = [
            listing({ id: "1", price_amount: 200000 }),
            listing({ id: "2", price_amount: 120000 }),
            listing({ id: "3", location: "Salt", price_amount: 120000 }),
            listing({ id: "4", location: "Salt", price_amount: 118000 }),
        ];

        const result = filterAndSortListings(items, {
            limit: 100,
            maxPrice: null,
            minPrice: null,
            onlyValue: true,
            q: "",
            sort: "value",
            sourceId: "",
        });

        expect(result.map((item) => item.id)).toEqual(["2"]);
    });

    it("builds benchmarks and sparkline points for visible markets", () => {
        const items = [
            listing({ id: "1", price_amount: 100000, last_seen_at: "2026-04-10T00:00:00.000Z" }),
            listing({ id: "2", price_amount: 140000, last_seen_at: "2026-04-15T00:00:00.000Z" }),
            listing({ id: "3", price_amount: 180000, last_seen_at: "2026-04-20T00:00:00.000Z" }),
        ];

        const benchmarks = buildRegionBenchmarks(items);
        const region = benchmarks.get("girona centre");

        expect(region?.averagePrice).toBe(140000);
        expect(region?.sparkline).toEqual([100000, 140000, 180000]);
        expect(buildSparklinePoints(region?.sparkline ?? [])).toContain("100.00");
    });

    it("calculates days on market and value anomalies", () => {
        const items = [listing({ id: "1", price_amount: 200000 }), listing({ id: "2", price_amount: 120000 })];
        const benchmarks = buildRegionBenchmarks(items);
        const firstItem = items[0];
        const secondItem = items[1];

        if (firstItem === undefined || secondItem === undefined) {
            throw new Error("expected test fixtures");
        }

        expect(getDaysOnMarket(firstItem)).toBe(19);
        expect(isValueListing(secondItem, benchmarks)).toBe(true);
    });
});
