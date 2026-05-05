/**
 * File: app/src/features/backoffice/SourcesPage.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of SourcesPage and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @tanstack/react-query, @testing-library/react, react-router-dom, vitest, @/components/ui/ToastProvider, @/features/backoffice/SourcesPage
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
 * - @/features/backoffice/SourcesPage
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