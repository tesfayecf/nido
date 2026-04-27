import { describe, expect, it } from "vitest";

import { buildPortfolioDashboardModel } from "@/features/properties/portfolioDashboard";
import type { PropertySummary } from "@/services/properties/properties.types";

const buildSummary = (
    id: string,
    price: string,
    delta: number,
): PropertySummary => ({
    current_values: {
        area_m2: "80",
        bathrooms: "2",
        price,
        property_age: "10",
        rooms: "4",
    },
    decision: {
        current_price: Number(price),
        current_price_per_sqm: Number(price) / 80,
        freshness_status: "fresh",
    },
    latest_change_summary: delta === 0 ? "" : "Price changed",
    property: {
        id,
        label: `Property ${id}`,
        status: "active",
        url: "",
    },
    signals: delta === 0 ? [] : [{
        field: "price",
        group: "pricing",
        impact: delta < 0 ? "positive" : "negative",
        label: "Price changed",
        observed_at: "2024-01-03T12:00:00.000Z",
        absolute_delta: delta,
        percent_delta: delta < 0 ? -5 : 5,
    }],
});

describe("buildPortfolioDashboardModel", () => {
    it("summarizes price movement and opportunity ranking", () => {
        const model = buildPortfolioDashboardModel([
            buildSummary("prop_1", "200000", -10000),
            buildSummary("prop_2", "260000", 5000),
            buildSummary("prop_3", "230000", 0),
        ]);

        expect(model.totalProperties).toBe(3);
        expect(model.priceMovement.decreases).toBe(1);
        expect(model.priceMovement.increases).toBe(1);
        expect(model.priceMovement.stagnant).toBe(1);
        expect(model.topOpportunities[0]?.propertyId).toBe("prop_1");
        expect(model.priceChanges).toHaveLength(2);
    });
});
