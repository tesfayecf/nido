import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { SourcesPage } from "@/features/backoffice/SourcesPage";

const deleteSourceMock = vi.fn();
const listPropertiesMock = vi.fn();
const listSourcesMock = vi.fn();
const ingestPropertyMock = vi.fn();

vi.mock("@/services/backoffice-sources/sources.service", () => ({
    deleteSource: (id: string) => deleteSourceMock(id),
    listSources: () => listSourcesMock(),
}));

vi.mock("@/services/properties/properties.service", () => ({
    ingestProperty: (id: string) => ingestPropertyMock(id),
    listProperties: () => listPropertiesMock(),
}));

const TEST_TIMEOUT_MS = 30000;

const renderSourcesPage = (): ReturnType<typeof render> => {
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
                    <SourcesPage />
                </ToastProvider>
            </MemoryRouter>
        </QueryClientProvider>,
    );
};

describe("SourcesPage", () => {
    beforeEach(() => {
        deleteSourceMock.mockReset();
        ingestPropertyMock.mockReset();
        listPropertiesMock.mockReset();
        listSourcesMock.mockReset();
        listSourcesMock.mockResolvedValue([
            {
                active: true,
                config_json: JSON.stringify([{ field: "price" }]),
                created_at: "2026-05-01T10:00:00.000Z",
                id: "source_1",
                name: "Idealista",
                updated_at: "2026-05-04T10:00:00.000Z",
            },
        ]);
        listPropertiesMock.mockResolvedValue([
            { id: "prop_1", source_id: "source_1" },
            { id: "prop_2", source_id: "source_1" },
        ]);
    });

    it("shows a source overview before the template table", async () => {
        renderSourcesPage();

        const overview = await screen.findByLabelText("Sources overview");

        expect(within(overview).getByText("Tracked properties")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create source" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Source templates" })).toBeInTheDocument();
        expect(await screen.findByText("Idealista")).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);
});