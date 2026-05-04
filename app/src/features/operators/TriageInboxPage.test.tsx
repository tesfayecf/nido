import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { TriageInboxPage } from "@/features/operators/TriageInboxPage";

const ingestPropertyMock = vi.fn();
const listNotificationsMock = vi.fn();
const listPropertiesMock = vi.fn();
const listRunsMock = vi.fn();
const markNotificationReadMock = vi.fn();

vi.mock("@/services/properties/properties.service", () => ({
    ingestProperty: (propertyId: string) => ingestPropertyMock(propertyId),
    listProperties: () => listPropertiesMock(),
}));

vi.mock("@/services/backoffice-runs/runs.service", () => ({
    listRuns: () => listRunsMock(),
}));

vi.mock("@/services/notifications/notifications.service", () => ({
    listNotifications: () => listNotificationsMock(),
    markNotificationRead: (notificationId: string) => markNotificationReadMock(notificationId),
}));

const renderTriageInboxPage = (): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
    const router = createMemoryRouter(
        [{ path: "/triage", element: <TriageInboxPage /> }],
        { initialEntries: ["/triage"] },
    );

    return render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <RouterProvider router={router} />
            </ToastProvider>
        </QueryClientProvider>,
    );
};

const TEST_TIMEOUT_MS = 30000;

describe("TriageInboxPage", () => {
    beforeEach(() => {
        ingestPropertyMock.mockReset();
        listNotificationsMock.mockReset();
        listPropertiesMock.mockReset();
        listRunsMock.mockReset();
        markNotificationReadMock.mockReset();

        listNotificationsMock.mockResolvedValue({ items: [] });
        listRunsMock.mockResolvedValue({ items: [] });
        listPropertiesMock.mockResolvedValue([
            { id: "prop_1", label: "Sunny flat", status: "degraded", updated_at: "2024-01-01T12:00:00.000Z", url: "https://example.com/1" },
            { id: "prop_2", label: "City loft", status: "degraded", updated_at: "2024-01-01T11:00:00.000Z", url: "https://example.com/2" },
        ]);
    });

    it("only disables the row action being processed", async () => {
        let resolveIngest: (() => void) | undefined;
        ingestPropertyMock.mockImplementation(() => new Promise<void>((resolve) => {
            resolveIngest = resolve;
        }));

        renderTriageInboxPage();

        const firstArticle = (await screen.findByText("Sunny flat is degraded")).closest("article");
        const secondArticle = (await screen.findByText("City loft is degraded")).closest("article");
        expect(firstArticle).not.toBeNull();
        expect(secondArticle).not.toBeNull();

        fireEvent.click(within(firstArticle as HTMLElement).getByRole("button", { name: "Run now" }));

        await waitFor(() => {
            expect(within(firstArticle as HTMLElement).getByText("Run now").closest("button")).toBeDisabled();
            expect(within(secondArticle as HTMLElement).getByText("Run now").closest("button")).not.toBeDisabled();
        });

        await act(async () => {
            resolveIngest?.();
        });
    }, TEST_TIMEOUT_MS);

    it("surfaces queue counts and list semantics before the work items", async () => {
        renderTriageInboxPage();

        await screen.findByText("Sunny flat is degraded");

        const openItems = screen.getByText("Open items");
        const queueSummary = openItems.closest("section");

        expect(queueSummary).not.toBeNull();
        expect(queueSummary).toHaveAttribute("aria-label", "Queue summary");
        expect(screen.getByRole("button", { name: "All severities (4)" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "High (4)" })).toBeInTheDocument();
        expect(screen.getAllByRole("listitem")).toHaveLength(4);
    }, TEST_TIMEOUT_MS);
});
