import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SourceDetailPage } from "@/features/backoffice/SourceDetailPage";
import type { Source } from "@/services/backoffice-sources/sources.types";

const getSourceMock = vi.fn<(sourceId: string) => Promise<Source>>();

vi.mock("@/services/backoffice-sources/sources.service", () => ({
    getSource: (sourceId: string) => getSourceMock(sourceId),
    upsertSource: vi.fn(),
}));

vi.mock("@/services/backoffice-runs/runs.service", () => ({
    ingestSource: vi.fn(),
}));

const EXISTING_SOURCE: Source = {
    active: true,
    browser_enabled: false,
    config_json: '{"mode":"existing"}',
    endpoint_url: "https://example.test/feed.json",
    id: "source-1",
    kind: "http-json-feed",
    name: "Existing Source",
};

const renderSourceDetailPage = (initialEntries: string[]): ReturnType<typeof createMemoryRouter> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
    const router = createMemoryRouter(
        [
            { path: "/backoffice/sources/new", element: <SourceDetailPage /> },
            { path: "/backoffice/sources/:sourceId", element: <SourceDetailPage /> },
        ],
        { initialEntries },
    );

    render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );

    return router;
};

describe("SourceDetailPage", () => {
    beforeEach(() => {
        getSourceMock.mockReset();
        getSourceMock.mockResolvedValue(EXISTING_SOURCE);
    });

    it("resets the form when navigating from an existing source to create mode", async () => {
        const router = renderSourceDetailPage(["/backoffice/sources/source-1"]);

        expect(await screen.findByDisplayValue("Existing Source")).toBeInTheDocument();
        expect(screen.queryByLabelText("Preset")).not.toBeInTheDocument();

        await act(async () => {
            await router.navigate("/backoffice/sources/new");
        });

        await waitFor(() => {
            expect(screen.getByLabelText("Preset")).toHaveValue("generic-json-feed");
            expect(screen.getByLabelText("Id")).toHaveValue("");
            expect(screen.getByLabelText("Name")).toHaveValue("");
            expect(screen.getByLabelText("Config JSON")).toHaveValue("{}");
        });
    });

    it("applies create presets without overwriting editable identity fields", async () => {
        renderSourceDetailPage(["/backoffice/sources/new"]);

        fireEvent.change(screen.getByLabelText("Id"), { target: { value: "idealista-bilbao" } });
        fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Idealista Bilbao" } });
        fireEvent.change(screen.getByLabelText("Endpoint URL"), { target: { value: "https://www.idealista.com/venta-viviendas/bilbao-vizcaya/" } });
        fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "idealista-search" } });

        await waitFor(() => {
            expect(screen.getByLabelText("Kind")).toHaveValue("html-listings");
            expect(screen.getByLabelText("Browser enabled")).toBeChecked();
            expect(screen.getByLabelText("Id")).toHaveValue("idealista-bilbao");
            expect(screen.getByLabelText("Name")).toHaveValue("Idealista Bilbao");
            expect(screen.getByLabelText("Endpoint URL")).toHaveValue("https://www.idealista.com/venta-viviendas/bilbao-vizcaya/");
        });

        const configField = screen.getByLabelText("Config JSON") as HTMLTextAreaElement;
        expect(configField.value).toContain('"item_selector": "article.item"');
        expect(configField.value).toContain('"title_selector": "a.item-link"');
        expect(configField.value).toContain('"external_id_attribute": "data-element-id"');
        expect(configField.value).toContain('"base_url": "https://www.idealista.com"');
        expect(configField.value).toContain('"currency": "EUR"');
        expect(screen.getByText(/Starter selectors for Idealista search result pages\./)).toBeInTheDocument();
    });
});