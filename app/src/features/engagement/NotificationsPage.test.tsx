import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsPage } from "@/features/engagement/NotificationsPage";

const listNotificationsMock = vi.fn();
const markNotificationReadMock = vi.fn();
const markNotificationUnreadMock = vi.fn();

vi.mock("@/services/notifications/notifications.service", () => ({
    listNotifications: (filters: unknown) => listNotificationsMock(filters),
    markNotificationRead: (id: string) => markNotificationReadMock(id),
    markNotificationUnread: (id: string) => markNotificationUnreadMock(id),
}));

const TEST_TIMEOUT_MS = 30000;

const renderNotificationsPage = (): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <NotificationsPage />
            </MemoryRouter>
        </QueryClientProvider>,
    );
};

describe("NotificationsPage", () => {
    beforeEach(() => {
        listNotificationsMock.mockReset();
        markNotificationReadMock.mockReset();
        markNotificationUnreadMock.mockReset();
        listNotificationsMock.mockResolvedValue({
            items: [
                {
                    body: "Price changed by 4%.",
                    created_at: "2026-05-04T09:30:00.000Z",
                    id: "notif_1",
                    kind: "price_drop",
                    property_id: "prop_1",
                    read_at: undefined,
                    title: "Price drop detected",
                },
                {
                    body: "Source returned stale data.",
                    created_at: "2026-05-03T08:00:00.000Z",
                    id: "notif_2",
                    kind: "status_change",
                    property_id: undefined,
                    read_at: "2026-05-03T08:15:00.000Z",
                    title: "Status changed",
                },
            ],
        });
    });

    it("surfaces an overview before the notification list and keeps filters in the header", async () => {
        renderNotificationsPage();

        const overview = await screen.findByLabelText("Notifications overview");

        expect(within(overview).getByText("In view")).toBeInTheDocument();
        expect(within(overview).getByText("Property links")).toBeInTheDocument();
        expect(screen.getByRole("checkbox", { name: "Unread only" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Notification list" })).toBeInTheDocument();
        expect(await screen.findByText("Price drop detected")).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);
});