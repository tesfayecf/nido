import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { TagsPage } from "@/features/tags/TagsPage";

const createTagMock = vi.fn();
const deleteTagMock = vi.fn();
const listTagsMock = vi.fn();

vi.mock("@/services/tags/tags.service", () => ({
    createTag: (payload: unknown) => createTagMock(payload),
    deleteTag: (id: string) => deleteTagMock(id),
    listTags: () => listTagsMock(),
}));

const TEST_TIMEOUT_MS = 30000;

const renderTagsPage = (): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <TagsPage />
            </ToastProvider>
        </QueryClientProvider>,
    );
};

describe("TagsPage", () => {
    beforeEach(() => {
        createTagMock.mockReset();
        deleteTagMock.mockReset();
        listTagsMock.mockReset();
        listTagsMock.mockResolvedValue([
            { color: "#1d4ed8", created_at: "2026-05-02T10:00:00.000Z", id: "tag_1", name: "Priority" },
        ]);
    });

    it("shows tag status before the tag list", async () => {
        renderTagsPage();

        const overview = await screen.findByLabelText("Tags overview");

        expect(within(overview).getByText("Colors")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create tag" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Tag list" })).toBeInTheDocument();
        expect(await screen.findByText("Priority")).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);
});