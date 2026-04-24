import { describe, expect, it } from "vitest";

import {
    buildAnalyticsFieldOptions,
    buildAnalyticsSummary,
    buildGroupedAnalytics,
    buildHistogramData,
    filterAnalyticsRecords,
} from "@/features/analytics/analytics.utils";
import type { AnalyticsRecord } from "@/services/analytics/analytics.types";
import type { FieldDefinitionUsage } from "@/services/fields/fields.types";

const fieldDefinitions: FieldDefinitionUsage[] = [
    {
        created_at: "2026-04-24T00:00:00.000Z",
        data_type: "number",
        display_name: "Price",
        id: "field-price",
        name: "price",
        properties_using: 3,
        system_defined: true,
        updated_at: "2026-04-24T00:00:00.000Z",
        value_count: 3,
    },
    {
        created_at: "2026-04-24T00:00:00.000Z",
        data_type: "number",
        display_name: "Bedrooms",
        id: "field-bedrooms",
        name: "bedrooms",
        properties_using: 3,
        system_defined: true,
        updated_at: "2026-04-24T00:00:00.000Z",
        value_count: 3,
    },
    {
        created_at: "2026-04-24T00:00:00.000Z",
        data_type: "string",
        display_name: "Location",
        id: "field-location",
        name: "location",
        properties_using: 3,
        system_defined: true,
        updated_at: "2026-04-24T00:00:00.000Z",
        value_count: 3,
    },
];

const records: AnalyticsRecord[] = [
    {
        observed_at: "2026-04-24T10:00:00.000Z",
        property_id: "property-1",
        property_label: "Bilbao flat",
        property_url: "https://example.com/1",
        status: "active",
        values: { bedrooms: "2", location: "Bilbao", price: "200000" },
    },
    {
        observed_at: "2026-04-24T10:00:00.000Z",
        property_id: "property-2",
        property_label: "Getxo house",
        property_url: "https://example.com/2",
        status: "active",
        values: { bedrooms: "3", location: "Getxo", price: "350000" },
    },
    {
        observed_at: "2026-04-24T10:00:00.000Z",
        property_id: "property-3",
        property_label: "Bilbao loft",
        property_url: "https://example.com/3",
        status: "degraded",
        values: { bedrooms: "2", location: "Bilbao", price: "260000" },
    },
];

describe("analytics.utils", () => {
    it("filters records with AND logic across categorical and range filters", () => {
        const fieldOptions = buildAnalyticsFieldOptions(fieldDefinitions);
        const filtered = filterAnalyticsRecords(records, [
            { field_name: "location", id: "filter-location", max: "", min: "", operator: "equals", value: "Bilbao" },
            { field_name: "price", id: "filter-price", max: "250000", min: "150000", operator: "between", value: "" },
        ], fieldOptions);

        expect(filtered.map((record) => record.property_id)).toEqual(["property-1"]);
    });

    it("builds grouped analytics using the selected metric", () => {
        const fieldOptions = buildAnalyticsFieldOptions(fieldDefinitions);
        const grouped = buildGroupedAnalytics(records, "bedrooms", "price", "average", "location", fieldOptions);

        const bilbaoTwoBedrooms = grouped.find((item) => item.label === "2" && item.segment === "Bilbao");
        const getxoThreeBedrooms = grouped.find((item) => item.label === "3" && item.segment === "Getxo");
        expect(bilbaoTwoBedrooms?.value).toBe(230000);
        expect(getxoThreeBedrooms?.value).toBe(350000);
    });

    it("builds histogram buckets and summary stats from numeric values", () => {
        const histogram = buildHistogramData(records, "price");
        const summary = buildAnalyticsSummary(records, "price");

        expect(histogram.length).toBeGreaterThan(0);
        expect(summary.total_records).toBe(3);
        expect(summary.measure_count).toBe(3);
        expect(summary.average).toBe(270000);
        expect(summary.median).toBe(260000);
    });
});
