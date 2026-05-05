/**
 * File: app/src/features/engagement/BookmarksPage.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of BookmarksPage and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @tanstack/react-query, @testing-library/react, react-router-dom, vitest, @/features/engagement/BookmarksPage
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @tanstack/react-query
 * - @testing-library/react
 * - react-router-dom
 * - vitest
 * - @/features/engagement/BookmarksPage
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
 * - /app/docs/features/engagement.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookmarksPage } from "@/features/engagement/BookmarksPage";

const deleteBookmarkMock = vi.fn();
const listBookmarksMock = vi.fn();

vi.mock("@/services/bookmarks/bookmarks.service", () => ({
    deleteBookmark: (propertyId: string) => deleteBookmarkMock(propertyId),
    listBookmarks: () => listBookmarksMock(),
}));

const TEST_TIMEOUT_MS = 30000;

const renderBookmarksPage = (): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <BookmarksPage />
            </MemoryRouter>
        </QueryClientProvider>,
    );
};

describe("BookmarksPage", () => {
    beforeEach(() => {
        deleteBookmarkMock.mockReset();
        listBookmarksMock.mockReset();
        window.localStorage.clear();
        listBookmarksMock.mockResolvedValue([
            {
                bookmarked_at: "2026-05-03T11:00:00.000Z",
                currency: "EUR",
                location: "Bilbao",
                price_amount: 250000,
                property_id: "prop_1",
                title: "Sunny flat",
                url: "https://example.com/listing",
            },
        ]);
    });

    it("surfaces bookmark status before the saved properties list", async () => {
        renderBookmarksPage();

        const overview = await screen.findByLabelText("Bookmarks overview");

        expect(within(overview).getByText("Groups")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create group" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Saved properties" })).toBeInTheDocument();
        expect(await screen.findByText("Sunny flat")).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);
});