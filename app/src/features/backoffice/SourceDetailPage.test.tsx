import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
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
            <ToastProvider>
                <RouterProvider router={router} />
            </ToastProvider>
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

        expect(await screen.findByText("Existing Source")).toBeInTheDocument();

        existingSourceView.unmount();
        renderSourceDetailPage(["/sources/new"]);

        await waitFor(() => {
            expect(screen.getByLabelText("Template id")).toHaveValue("");
            expect(screen.getByLabelText("Template name")).toHaveValue("");
            expect(screen.getAllByLabelText("Field name").map((input) => (input as HTMLInputElement).value)).toEqual(["price", "title", "location"]);
        });
    });

    it("keeps manual source fields editable in create mode", async () => {
        renderSourceDetailPage(["/sources/new"]);
        const firstFieldName = screen.getAllByLabelText("Field name").at(0);
        const firstPrimarySelector = screen.getAllByLabelText("Primary selector").at(0);

        expect(firstFieldName).toBeDefined();
        expect(firstPrimarySelector).toBeDefined();

        fireEvent.change(screen.getByLabelText("Template id"), { target: { value: "idealista-template" } });
        fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Idealista Template" } });
        fireEvent.change(firstFieldName as HTMLElement, { target: { value: "salePrice" } });
        fireEvent.change(firstPrimarySelector as HTMLElement, { target: { value: ".price" } });

        await waitFor(() => {
            expect(screen.getByLabelText("Template id")).toHaveValue("idealista-template");
            expect(screen.getByLabelText("Template name")).toHaveValue("Idealista Template");
            expect(firstFieldName).toHaveValue("salePrice");
            expect(firstPrimarySelector).toHaveValue(".price");
        });
    });
});
