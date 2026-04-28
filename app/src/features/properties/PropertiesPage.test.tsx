import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { PropertiesPage } from "@/features/properties/PropertiesPage";
import type { Property } from "@/services/properties/properties.types";

const createBookmarkMock = vi.fn();
const deleteBookmarkMock = vi.fn();
const ingestPropertyMock = vi.fn();
const listBookmarksMock = vi.fn();
const listPropertiesMock = vi.fn();
const listPropertySummariesMock = vi.fn();
const listPropertyTagsMock = vi.fn();

vi.mock("@/services/bookmarks/bookmarks.service", () => ({
    createBookmark: (propertyId: string) => createBookmarkMock(propertyId),
    deleteBookmark: (propertyId: string) => deleteBookmarkMock(propertyId),
    listBookmarks: () => listBookmarksMock(),
}));

vi.mock("@/services/properties/properties.service", () => ({
    ingestProperty: (propertyId: string) => ingestPropertyMock(propertyId),
    listProperties: () => listPropertiesMock(),
    listPropertySummaries: () => listPropertySummariesMock(),
}));

vi.mock("@/services/tags/tags.service", () => ({
    listPropertyTags: () => listPropertyTagsMock(),
}));

const PROPERTY: Property = {
    id: "prop_1",
    label: "Sunny flat",
    status: "active",
    updated_at: "2024-01-01T12:00:00.000Z",
    url: "https://example.com/listing",
};

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
        deleteBookmarkMock.mockReset();
        ingestPropertyMock.mockReset();
        listBookmarksMock.mockReset();
        listPropertiesMock.mockReset();
        listPropertySummariesMock.mockReset();
        listPropertyTagsMock.mockReset();

        listBookmarksMock.mockResolvedValue([]);
        listPropertiesMock.mockResolvedValue([PROPERTY]);
        listPropertySummariesMock.mockResolvedValue([]);
        listPropertyTagsMock.mockResolvedValue([]);
    });

    it("opens the property from the row click and removes the redundant open button", async () => {
        const { router } = renderPropertiesPage();

        fireEvent.click(await screen.findByRole("button", { name: "Open property Sunny flat" }));

        expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
        await waitFor(() => {
            expect(router.state.location.pathname).toBe("/properties/prop_1");
        });
    });

    it("does not navigate when an inner row action is clicked", async () => {
        const { router } = renderPropertiesPage();

        fireEvent.click(await screen.findByRole("button", { name: "Bookmark property" }));

        await waitFor(() => {
            expect(createBookmarkMock).toHaveBeenCalledWith("prop_1");
        });
        expect(router.state.location.pathname).toBe("/properties");
    });
});
