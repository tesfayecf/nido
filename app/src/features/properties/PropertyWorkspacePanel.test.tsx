import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { PropertyWorkspacePanel } from "@/features/properties/PropertyWorkspacePanel";

const getPropertyMetadataMock = vi.fn();
const listPropertyAuditMock = vi.fn();
const updatePropertyMetadataMock = vi.fn();

vi.mock("@/services/workspace/workspace.service", () => ({
    getPropertyMetadata: (propertyId: string) => getPropertyMetadataMock(propertyId),
    listPropertyAudit: (propertyId: string) => listPropertyAuditMock(propertyId),
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
        getPropertyMetadataMock.mockReset();
        listPropertyAuditMock.mockReset();
        updatePropertyMetadataMock.mockReset();

        getPropertyMetadataMock.mockResolvedValue({
            acquisition_notes: "Call broker",
            pipeline_stage: "underwriting",
            priority: "high",
            property_id: "prop_1",
            workflow_state: "investigating",
        });
        listPropertyAuditMock.mockResolvedValue([
            { created_at: "2024-01-01T12:10:00.000Z", id: "audit_1", summary: "Property context updated", target_id: "prop_1", target_kind: "property" },
        ]);
        updatePropertyMetadataMock.mockResolvedValue({
            acquisition_notes: "Call broker",
            pipeline_stage: "underwriting",
            priority: "critical",
            property_id: "prop_1",
            workflow_state: "resolved",
        });
    });

    it("renders property context and activity data", async () => {
        renderPanel();

        expect(await screen.findByDisplayValue("investigating")).toBeInTheDocument();
        expect(screen.getByDisplayValue("underwriting")).toBeInTheDocument();
        expect(screen.getByText("Property context updated")).toBeInTheDocument();
    });

    it("saves updated property context", async () => {
        renderPanel();

        const selects = await screen.findAllByRole("combobox");
        const workflowSelect = selects[0]!;
        const prioritySelect = selects[1]!;
        fireEvent.change(workflowSelect, { target: { value: "resolved" } });
        fireEvent.change(prioritySelect, { target: { value: "critical" } });
        await screen.findByText("resolved");
        fireEvent.click(screen.getByRole("button", { name: "Save context" }));

        await waitFor(() => {
            expect(updatePropertyMetadataMock).toHaveBeenCalledWith("prop_1", expect.objectContaining({
                priority: "critical",
                property_id: "prop_1",
            }));
        });
    });
});
