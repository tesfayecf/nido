import { describe, expect, it } from "vitest";

import { buildPriceIntelligence, classifyPrice } from "@/features/properties/priceIntelligence";
import { DEFAULT_WORKSPACE_SETTINGS } from "@/features/settings/workspaceSettings";
import type { PropertySummary } from "@/services/properties/properties.types";

const buildSummary = (
    id: string,
    price: number,
    overrides?: Partial<PropertySummary>,
): PropertySummary => ({
    current_values: {
        area_m2: "80",
        location: "Bilbao",
        price: `${price}`,
        type: "flat",
    },
    decision: {
        current_price: price,
        freshness_status: "fresh",
        target_price: 200000,
        ...overrides?.decision,
    },
    latest_change_summary: "",
    property: {
        id,
        label: id,
        status: "active",
        url: `https://example.com/${id}`,
        ...overrides?.property,
    },
    signals: [],
    ...overrides,
});

describe("priceIntelligence", () => {
    it("classifies prices using configurable target thresholds", () => {
        expect(classifyPrice(-6, DEFAULT_WORKSPACE_SETTINGS)).toBe("cheap");
        expect(classifyPrice(2, DEFAULT_WORKSPACE_SETTINGS)).toBe("fair");
        expect(classifyPrice(8, DEFAULT_WORKSPACE_SETTINGS)).toBe("expensive");
    });

    it("computes market comparison from matching comparable fields before falling back global", () => {
        const target = buildSummary("target", 190000);
        const comparable = buildSummary("comp-1", 210000);
        const globalOnly = buildSummary("global", 260000, {
            current_values: {
                area_m2: "90",
                location: "Madrid",
                price: "260000",
                type: "house",
            },
            decision: {
                current_price: 260000,
                freshness_status: "fresh",
            },
        });

        const result = buildPriceIntelligence(target, [target, comparable, globalOnly], DEFAULT_WORKSPACE_SETTINGS);

        expect(result.market_average).toBe(210000);
        expect(result.comparable_count).toBe(1);
        expect(result.market_delta_absolute).toBe(-20000);
        expect(result.classification).toBe("cheap");
    });
});
