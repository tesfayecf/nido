import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { RunsPage } from "@/features/backoffice/RunsPage";

const deleteRunMock = vi.fn();
const listRunsMock = vi.fn();
const ingestPropertyMock = vi.fn();
const listPropertiesMock = vi.fn();
const listPropertyTagsMock = vi.fn();
const listSourcesMock = vi.fn();
const listTagsMock = vi.fn();

vi.mock("@/services/backoffice-runs/runs.service", () => ({
    deleteRun: (id: string) => deleteRunMock(id),
    listRuns: (filters: unknown) => listRunsMock(filters),
}));

vi.mock("@/services/properties/properties.service", () => ({
    ingestProperty: (id: string) => ingestPropertyMock(id),
    listProperties: () => listPropertiesMock(),
}));

vi.mock("@/services/backoffice-sources/sources.service", () => ({
    listSources: () => listSourcesMock(),
}));

vi.mock("@/services/tags/tags.service", () => ({
    listPropertyTags: (propertyId: string) => listPropertyTagsMock(propertyId),
    listTags: () => listTagsMock(),
}));

const TEST_TIMEOUT_MS = 30000;

const renderRunsPage = (): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <ToastProvider>
                    <RunsPage />
                </ToastProvider>
            </MemoryRouter>
        </QueryClientProvider>,
    );
};

describe("RunsPage", () => {
    beforeEach(() => {
        deleteRunMock.mockReset();
        ingestPropertyMock.mockReset();
        listPropertyTagsMock.mockReset();
        listPropertiesMock.mockReset();
        listRunsMock.mockReset();
        listSourcesMock.mockReset();
        listTagsMock.mockReset();
        listRunsMock.mockResolvedValue({
            items: [
                {
                    error_message: "Parser timeout",
                    id: "run_1",
                    is_valid: false,
                    observed_at: "2026-05-04T10:00:00.000Z",
                    property_id: "prop_1",
                    values: { price: 250000 },
                },
            ],
        });
        listPropertiesMock.mockResolvedValue([{ id: "prop_1", label: "Bilbao flat", url: "https://example.com/1" }]);
        listSourcesMock.mockResolvedValue([]);
        listTagsMock.mockResolvedValue([]);
        listPropertyTagsMock.mockResolvedValue([]);
    });

    it("surfaces run scope before the run history table", async () => {
        renderRunsPage();

        const overview = await screen.findByLabelText("Runs overview");

        expect(within(overview).getByText("Failures")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create run" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Run history" })).toBeInTheDocument();
        expect(await screen.findByText("run_1")).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);
});