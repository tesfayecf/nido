/**
 * File: app/src/features/properties/PropertiesPage.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of PropertiesPage and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @tanstack/react-query, @testing-library/react, react-router-dom, vitest, @/components/ui/ToastProvider, @/features/properties/PropertiesPage, @/services/properties/properties.types
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
 * - @/features/properties/PropertiesPage
 * - @/services/properties/properties.types
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
 * - /app/docs/features/properties.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { PropertiesPage } from "@/features/properties/PropertiesPage";
import type { Property } from "@/services/properties/properties.types";

const createBookmarkMock = vi.fn();
const deletePropertyMock = vi.fn();
const deleteBookmarkMock = vi.fn();
const ingestPropertyMock = vi.fn();
const listAlertRulesMock = vi.fn();
const listBookmarksMock = vi.fn();
const listPropertiesMock = vi.fn();
const listPropertySummariesMock = vi.fn();
const listPropertyTagsMock = vi.fn();
const listTagsMock = vi.fn();
const setAlertRuleEnabledMock = vi.fn();
const setPropertyTagsMock = vi.fn();
const updatePropertyMock = vi.fn();

vi.mock("@/services/alert-rules/alert-rules.service", () => ({
    listAlertRules: () => listAlertRulesMock(),
    setAlertRuleEnabled: (ruleId: string, enabled: boolean) => setAlertRuleEnabledMock(ruleId, enabled),
}));

vi.mock("@/services/bookmarks/bookmarks.service", () => ({
    createBookmark: (propertyId: string) => createBookmarkMock(propertyId),
    deleteBookmark: (propertyId: string) => deleteBookmarkMock(propertyId),
    listBookmarks: () => listBookmarksMock(),
}));

vi.mock("@/services/properties/properties.service", () => ({
    deleteProperty: (propertyId: string) => deletePropertyMock(propertyId),
    ingestProperty: (propertyId: string) => ingestPropertyMock(propertyId),
    listProperties: () => listPropertiesMock(),
    listPropertySummaries: () => listPropertySummariesMock(),
    updateProperty: (propertyId: string, payload: Record<string, unknown>) => updatePropertyMock(propertyId, payload),
}));

vi.mock("@/services/tags/tags.service", () => ({
    listTags: () => listTagsMock(),
    listPropertyTags: () => listPropertyTagsMock(),
    setPropertyTags: (propertyId: string, tagIds: string[]) => setPropertyTagsMock(propertyId, tagIds),
}));

const PROPERTY: Property = {
    id: "prop_1",
    label: "Sunny flat",
    status: "active",
    updated_at: "2024-01-01T12:00:00.000Z",
    url: "https://example.com/listing",
};

const TEST_TIMEOUT_MS = 30000;

const renderPropertiesPage = (): { readonly router: ReturnType<typeof createMemoryRouter>; } & ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
    const router = createMemoryRouter(
        [
            { path: "/properties", element: <PropertiesPage /> },
            { path: "/properties/:propertyId", element: <div>{"Property detail"}</div> },
        ],
        { initialEntries: ["/properties"] },
    );

    return {
        router,
        ...render(
            <QueryClientProvider client={queryClient}>
                <ToastProvider>
                    <RouterProvider router={router} />
                </ToastProvider>
            </QueryClientProvider>,
        ),
    };
};

describe("PropertiesPage", () => {
    beforeEach(() => {
        createBookmarkMock.mockReset();
        deletePropertyMock.mockReset();
        deleteBookmarkMock.mockReset();
        ingestPropertyMock.mockReset();
        listAlertRulesMock.mockReset();
        listBookmarksMock.mockReset();
        listPropertiesMock.mockReset();
        listPropertySummariesMock.mockReset();
        listPropertyTagsMock.mockReset();
        listTagsMock.mockReset();
        setAlertRuleEnabledMock.mockReset();
        setPropertyTagsMock.mockReset();
        updatePropertyMock.mockReset();
        sessionStorage.clear();

        listAlertRulesMock.mockResolvedValue([]);
        listBookmarksMock.mockResolvedValue([]);
        listPropertiesMock.mockResolvedValue([PROPERTY]);
        listPropertySummariesMock.mockResolvedValue([]);
        listPropertyTagsMock.mockResolvedValue([]);
        listTagsMock.mockResolvedValue([]);
    });

    it("opens the property from the row click and removes the redundant open button", async () => {
        const { router } = renderPropertiesPage();

        fireEvent.click(await screen.findByRole("button", { name: "Open property Sunny flat" }));

        expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
        await waitFor(() => {
            expect(router.state.location.pathname).toBe("/properties/prop_1");
        });
    }, TEST_TIMEOUT_MS);

    it("does not navigate when an inner row action is clicked", async () => {
        const { router } = renderPropertiesPage();

        fireEvent.click(await screen.findByRole("button", { name: "Bookmark property" }));

        await waitFor(() => {
            expect(createBookmarkMock).toHaveBeenCalledWith("prop_1");
        });
        expect(router.state.location.pathname).toBe("/properties");
    }, TEST_TIMEOUT_MS);

    it("keeps the custom properties table paginated for large portfolios", async () => {
        listPropertiesMock.mockResolvedValue(Array.from({ length: 60 }, (_, index) => buildProperty(index + 1)));

        renderPropertiesPage();

        expect(await screen.findByText("Page 1 of 2 · 60 properties")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Open property Property 1" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Open property Property 60" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Next" }));

        expect(screen.getByText("Page 2 of 2 · 60 properties")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Open property Property 60" })).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);

    it("surfaces portfolio scope and active filter state ahead of the table", async () => {
        renderPropertiesPage();

        expect(await screen.findByLabelText("Portfolio snapshot")).toBeInTheDocument();
        expect(screen.getByText("Tracked properties")).toBeInTheDocument();
        expect(screen.getByText("In current view")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Filters" }));
        fireEvent.change(screen.getByPlaceholderText("Filter"), { target: { value: "Missing" } });

        expect(screen.getByRole("button", { name: "Hide filters (1 active)" })).toBeInTheDocument();
        expect(screen.getByText("No properties match the current filters. Clear filters or adjust the table controls.")).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);
});

const buildProperty = (index: number): Property => ({
    id: `prop_${index}`,
    label: `Property ${index}`,
    status: "active",
    updated_at: "2024-01-01T12:00:00.000Z",
    url: `https://example.com/listing-${index}`,
});
