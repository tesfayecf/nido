import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SourceDetailPage } from "@/features/backoffice/SourceDetailPage";
import type { Source } from "@/services/backoffice-sources/sources.types";

const getSourceMock = vi.fn<(sourceId: string) => Promise<Source>>();

vi.mock("@/services/backoffice-sources/sources.service", () => ({
    deleteSource: vi.fn(),
    getSource: (sourceId: string) => getSourceMock(sourceId),
    upsertSource: vi.fn(),
}));

const EXISTING_SOURCE: Source = {
    config_json: '[{"name":"price","selectors":[".price"],"required":true}]',
    id: "source-1",
    name: "Existing Source",
};

const renderSourceDetailPage = (initialEntries: string[]): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
    const router = createMemoryRouter(
        [
            { path: "/sources/new", element: <SourceDetailPage /> },
            { path: "/sources/:sourceId", element: <SourceDetailPage /> },
        ],
        { initialEntries },
    );

    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );
};

describe("SourceDetailPage", () => {
    beforeEach(() => {
        getSourceMock.mockReset();
        getSourceMock.mockResolvedValue(EXISTING_SOURCE);
    });

    it("resets the form when navigating from an existing source to create mode", async () => {
        const existingSourceView = renderSourceDetailPage(["/sources/source-1"]);

        expect(await screen.findByDisplayValue("Existing Source")).toBeInTheDocument();

        existingSourceView.unmount();
        renderSourceDetailPage(["/sources/new"]);

        await waitFor(() => {
            expect(screen.getByLabelText("Id")).toHaveValue("");
            expect(screen.getByLabelText("Name")).toHaveValue("");
            expect(screen.getByLabelText("Selectors JSON")).toHaveValue("[]");
        });
    });

    it("keeps manual source fields editable in create mode", async () => {
        renderSourceDetailPage(["/sources/new"]);

        fireEvent.change(screen.getByLabelText("Id"), { target: { value: "idealista-template" } });
        fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Idealista Template" } });
        fireEvent.change(screen.getByLabelText("Selectors JSON"), { target: { value: '[{"name":"price","selectors":[".price"],"required":true}]' } });

        await waitFor(() => {
            expect(screen.getByLabelText("Id")).toHaveValue("idealista-template");
            expect(screen.getByLabelText("Name")).toHaveValue("Idealista Template");
            expect(screen.getByLabelText("Selectors JSON")).toHaveValue('[{"name":"price","selectors":[".price"],"required":true}]');
        });
    });
});
