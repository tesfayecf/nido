import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "@/features/operators/DashboardPage";
import type { PropertySummary } from "@/services/properties/properties.types";

const listPropertySummariesMock = vi.fn<() => Promise<PropertySummary[]>>();

vi.mock("@/services/properties/properties.service", () => ({
    listPropertySummaries: () => listPropertySummariesMock(),
}));

const SUMMARIES: PropertySummary[] = [
    {
        current_values: { area_m2: "80", bathrooms: "1", price: "200000", rooms: "2" },
        decision: { current_price: 200000, current_price_per_sqm: 2500, freshness_status: "fresh" },
        latest_change_summary: "Price reduced",
        property: {
            id: "prop_1",
            label: "Bilbao flat",
            status: "active",
            url: "https://example.com/1",
        },
        signals: [{ absolute_delta: -10000, field: "price", group: "pricing", impact: "positive", label: "Price", observed_at: "2026-05-01T10:00:00.000Z", percent_delta: -4.8 }],
    },
    {
        current_values: { area_m2: "100", bathrooms: "2", price: "320000", rooms: "3" },
        decision: { current_price: 320000, current_price_per_sqm: 3200, freshness_status: "fresh" },
        latest_change_summary: "Price increased",
        property: {
            id: "prop_2",
            label: "Getxo house",
            status: "active",
            url: "https://example.com/2",
        },
        signals: [{ absolute_delta: 5000, field: "price", group: "pricing", impact: "negative", label: "Price", observed_at: "2026-05-02T11:00:00.000Z", percent_delta: 1.6 }],
    },
];

const TEST_TIMEOUT_MS = 30000;

const renderDashboardPage = (): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <DashboardPage />
            </MemoryRouter>
        </QueryClientProvider>,
    );
};

describe("DashboardPage", () => {
    beforeEach(() => {
        listPropertySummariesMock.mockReset();
        listPropertySummariesMock.mockResolvedValue(SUMMARIES);
    });

    it("surfaces an action summary before the supporting charts and lists recent price changes", async () => {
        renderDashboardPage();

        const leadOpportunity = await screen.findByText("Lead opportunity");
        const actionSummary = leadOpportunity.closest("section");

        expect(actionSummary).not.toBeNull();
        expect(actionSummary).toHaveAttribute("aria-label", "Action summary");
        expect(screen.getByText("Movement window")).toBeInTheDocument();
        const recentChangesCard = screen.getByRole("heading", { name: "Recent price changes" }).closest("section");

        expect(recentChangesCard).not.toBeNull();
        expect(within(recentChangesCard as HTMLElement).getByText("Bilbao flat")).toBeInTheDocument();
        expect(within(recentChangesCard as HTMLElement).getByText("Getxo house")).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);
});