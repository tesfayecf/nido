/**
 * File: app/src/features/backoffice/SourceDetailPage.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of SourceDetailPage and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @tanstack/react-query, @testing-library/react, react-router-dom, vitest, @/components/ui/ToastProvider, @/features/backoffice/SourceDetailPage, @/services/backoffice-sources/sources.types
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @tanstack/react-query
 * - @testing-library/react
 * - react-router-dom
 * - vitest
 * - @/components/ui/ToastProvider
 * - @/features/backoffice/SourceDetailPage
 * - @/services/backoffice-sources/sources.types
 *
 * Key Decisions:
 * - Keeps documentation adjacent to the implementation so future changes update behavior and context together.
 * - Uses explicit imports and typed boundaries to make ownership traceable from this file in isolation.
 *
 * Constraints:
 * - Documentation must remain synchronized with behavior, tests, and related docs when this file changes.
 * - Runtime behavior must not depend on comments or documentation-only metadata.
 *
 * Related:
 * - /docs/frontend/documentation-template.md
 * - /app/docs/features/backoffice.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { SourceDetailPage } from "@/features/backoffice/SourceDetailPage";
import type { Source } from "@/services/backoffice-sources/sources.types";

const getSourceMock = vi.fn<(sourceId: string) => Promise<Source>>();
const listFieldsMock = vi.fn();
const listPropertiesMock = vi.fn();
const listPropertySnapshotsMock = vi.fn();

vi.mock("@/services/backoffice-sources/sources.service", () => ({
    deleteSource: vi.fn(),
    getSource: (sourceId: string) => getSourceMock(sourceId),
    upsertSource: vi.fn(),
}));

vi.mock("@/services/properties/properties.service", () => ({
    listProperties: () => listPropertiesMock(),
    listPropertySnapshots: () => listPropertySnapshotsMock(),
    previewExtraction: vi.fn(),
}));

vi.mock("@/services/fields/fields.service", () => ({
    listFields: () => listFieldsMock(),
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
        listPropertiesMock.mockReset();
        listPropertySnapshotsMock.mockReset();
        listFieldsMock.mockReset();
        getSourceMock.mockResolvedValue(EXISTING_SOURCE);
        listFieldsMock.mockResolvedValue([]);
        listPropertiesMock.mockResolvedValue([]);
        listPropertySnapshotsMock.mockResolvedValue([]);
    });

    it("resets the form when navigating from an existing source to create mode", async () => {
        const existingSourceView = renderSourceDetailPage(["/sources/source-1"]);

        expect(await screen.findByText("Existing Source")).toBeInTheDocument();

        existingSourceView.unmount();
        renderSourceDetailPage(["/sources/new"]);

        await waitFor(() => {
            expect(screen.getByLabelText("Template id")).toHaveValue("");
            expect(screen.getByLabelText("Template name")).toHaveValue("");
            expect(screen.getByRole("button", { name: /price/i })).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: /title/i })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: /location/i })).not.toBeInTheDocument();
        });
    });

    it("opens the edit modal with the existing source values populated", async () => {
        renderSourceDetailPage(["/sources/source-1"]);

        fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

        await waitFor(() => {
            expect(screen.getByLabelText("Template id")).toHaveValue("source-1");
            expect(screen.getByLabelText("Template name")).toHaveValue("Existing Source");
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
