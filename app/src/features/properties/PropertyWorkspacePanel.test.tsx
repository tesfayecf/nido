import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { PropertyWorkspacePanel } from "@/features/properties/PropertyWorkspacePanel";

const getCurrentUserMock = vi.fn();
const listWorkspaceUsersMock = vi.fn();
const createPropertyCommentMock = vi.fn();
const getPropertyMetadataMock = vi.fn();
const listPropertyAuditMock = vi.fn();
const listPropertyCommentsMock = vi.fn();
const listPropertyWatchersMock = vi.fn();
const subscribePropertyMock = vi.fn();
const unsubscribePropertyMock = vi.fn();
const updatePropertyMetadataMock = vi.fn();

vi.mock("@/services/auth/auth.service", () => ({
    getCurrentUser: () => getCurrentUserMock(),
    listWorkspaceUsers: () => listWorkspaceUsersMock(),
}));

vi.mock("@/services/workspace/workspace.service", () => ({
    createPropertyComment: (propertyId: string, body: string) => createPropertyCommentMock(propertyId, body),
    getPropertyMetadata: (propertyId: string) => getPropertyMetadataMock(propertyId),
    listPropertyAudit: (propertyId: string) => listPropertyAuditMock(propertyId),
    listPropertyComments: (propertyId: string) => listPropertyCommentsMock(propertyId),
    listPropertyWatchers: (propertyId: string) => listPropertyWatchersMock(propertyId),
    subscribeProperty: (propertyId: string) => subscribePropertyMock(propertyId),
    unsubscribeProperty: (propertyId: string) => unsubscribePropertyMock(propertyId),
    updatePropertyMetadata: (propertyId: string, payload: unknown) => updatePropertyMetadataMock(propertyId, payload),
}));

const renderPanel = (): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <PropertyWorkspacePanel propertyId={"prop_1"} />
            </ToastProvider>
        </QueryClientProvider>,
    );
};

describe("PropertyWorkspacePanel", () => {
    beforeEach(() => {
        getCurrentUserMock.mockReset();
        listWorkspaceUsersMock.mockReset();
        createPropertyCommentMock.mockReset();
        getPropertyMetadataMock.mockReset();
        listPropertyAuditMock.mockReset();
        listPropertyCommentsMock.mockReset();
        listPropertyWatchersMock.mockReset();
        subscribePropertyMock.mockReset();
        unsubscribePropertyMock.mockReset();
        updatePropertyMetadataMock.mockReset();

        getCurrentUserMock.mockResolvedValue({
            display_name: "Admin",
            email: "admin@local",
            id: "usr_admin",
            role: "admin",
        });
        listWorkspaceUsersMock.mockResolvedValue([
            { display_name: "Admin", email: "admin@local", id: "usr_admin", role: "admin" },
            { display_name: "Operator", email: "operator@local", id: "usr_operator", role: "operator" },
        ]);
        getPropertyMetadataMock.mockResolvedValue({
            owner_id: "usr_operator",
            priority: "high",
            property_id: "prop_1",
            workflow_state: "investigating",
        });
        listPropertyWatchersMock.mockResolvedValue([{ property_id: "prop_1", user_id: "usr_admin" }]);
        listPropertyCommentsMock.mockResolvedValue([
            { body: "Initial note", created_at: "2024-01-01T12:00:00.000Z", id: "comment_1", property_id: "prop_1", user_id: "usr_operator" },
        ]);
        listPropertyAuditMock.mockResolvedValue([
            { created_at: "2024-01-01T12:10:00.000Z", id: "audit_1", summary: "Workflow state changed", target_id: "prop_1", target_kind: "property" },
        ]);
        updatePropertyMetadataMock.mockResolvedValue({
            owner_id: "usr_operator",
            priority: "high",
            property_id: "prop_1",
            workflow_state: "investigating",
        });
        createPropertyCommentMock.mockResolvedValue({
            body: "Ping @operator@local",
            created_at: "2024-01-01T12:15:00.000Z",
            id: "comment_2",
            property_id: "prop_1",
            user_id: "usr_admin",
        });
    });

    it("renders workspace metadata and audit data", async () => {
        renderPanel();

        expect(await screen.findByText("Operator")).toBeInTheDocument();
        expect(screen.getByDisplayValue("investigating")).toBeInTheDocument();
        expect(screen.getByText("Workflow state changed")).toBeInTheDocument();
    });

    it("submits a new comment", async () => {
        renderPanel();

        fireEvent.change(await screen.findByRole("textbox", { name: "New comment" }), { target: { value: "Ping @operator@local" } });
        fireEvent.click(screen.getByRole("button", { name: "Post comment" }));

        await waitFor(() => {
            expect(createPropertyCommentMock).toHaveBeenCalledWith("prop_1", "Ping @operator@local");
        });
    });
});
