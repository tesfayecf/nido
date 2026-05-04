import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";
import type { AnalyticsRecord } from "@/services/analytics/analytics.types";
import type { FieldDefinitionUsage } from "@/services/fields/fields.types";

const listFieldsMock = vi.fn<() => Promise<FieldDefinitionUsage[]>>();
const listAnalyticsDatasetMock = vi.fn<() => Promise<AnalyticsRecord[]>>();

vi.mock("@/services/fields/fields.service", () => ({
    listFields: () => listFieldsMock(),
}));

vi.mock("@/services/analytics/analytics.service", () => ({
    listAnalyticsDataset: () => listAnalyticsDatasetMock(),
}));

const FIELD_DEFINITIONS: FieldDefinitionUsage[] = [
    {
        created_at: "2026-04-24T00:00:00.000Z",
        data_type: "number",
        display_name: "Price",
        id: "field-price",
        name: "price",
        properties_using: 3,
        system_defined: true,
        unit: "€",
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

const RECORDS: AnalyticsRecord[] = [
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

const TEST_TIMEOUT_MS = 30000;

const renderAnalyticsPage = (): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
    const router = createMemoryRouter(
        [{ path: "/analytics", element: <AnalyticsPage /> }],
        { initialEntries: ["/analytics"] },
    );

    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );
};

describe("AnalyticsPage", () => {
    beforeEach(() => {
        listFieldsMock.mockReset();
        listAnalyticsDatasetMock.mockReset();

        listFieldsMock.mockResolvedValue(FIELD_DEFINITIONS);
        listAnalyticsDatasetMock.mockResolvedValue(RECORDS);
    });

    it("renders the default analytics summary and control set", async () => {
        renderAnalyticsPage();

        expect(await screen.findByText("Properties in scope")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Histogram")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Price")).toBeInTheDocument();
        expect(screen.getByText("Bilbao flat")).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);

    it("applies a categorical filter and updates the filtered dataset summary", async () => {
        renderAnalyticsPage();

        const initialComboboxCount = (await screen.findAllByRole("combobox")).length;
        fireEvent.click(await screen.findByRole("button", { name: "Add filter" }));
        await waitFor(() => {
            expect(screen.getAllByRole("combobox").length).toBeGreaterThan(initialComboboxCount);
        });

        const comboboxesAfterAdd = screen.getAllByRole("combobox");
        const fieldSelect = comboboxesAfterAdd[initialComboboxCount];
        expect(fieldSelect).toBeDefined();
        fireEvent.change(fieldSelect as HTMLSelectElement, { target: { value: "location" } });

        await waitFor(() => {
            expect(screen.getAllByRole("combobox").length).toBeGreaterThan(comboboxesAfterAdd.length);
        });
        const valueSelect = screen.getAllByRole("combobox").at(-1);
        expect(valueSelect).toBeDefined();
        fireEvent.change(valueSelect as HTMLSelectElement, { target: { value: "Bilbao" } });

        await waitFor(() => {
            expect(screen.queryByText("Getxo house")).not.toBeInTheDocument();
        });
        expect(screen.getByText("Bilbao loft")).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);

    it("surfaces the current investigation state and lets operators clear filters", async () => {
        renderAnalyticsPage();

        expect(await screen.findByLabelText("Analysis snapshot")).toBeInTheDocument();
        expect(screen.getByText("Primary measure")).toBeInTheDocument();
        expect(screen.getByText("Scope")).toBeInTheDocument();

        const initialComboboxCount = (await screen.findAllByRole("combobox")).length;
        fireEvent.click(screen.getByRole("button", { name: "Add filter" }));

        await waitFor(() => {
            expect(screen.getAllByRole("combobox").length).toBeGreaterThan(initialComboboxCount);
        });

        const comboboxesAfterAdd = screen.getAllByRole("combobox");
        fireEvent.change(comboboxesAfterAdd[initialComboboxCount] as HTMLSelectElement, { target: { value: "location" } });

        await waitFor(() => {
            expect(screen.getAllByRole("combobox").length).toBeGreaterThan(comboboxesAfterAdd.length);
        });

        fireEvent.change(screen.getAllByRole("combobox").at(-1) as HTMLSelectElement, { target: { value: "Bilbao" } });

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
            expect(screen.queryByText("Getxo house")).not.toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

        await waitFor(() => {
            expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
            expect(screen.getByText("Getxo house")).toBeInTheDocument();
        });
    }, TEST_TIMEOUT_MS);
});
