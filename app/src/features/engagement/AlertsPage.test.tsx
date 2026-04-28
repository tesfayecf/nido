import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { AlertsPage } from "@/features/engagement/AlertsPage";

const createAlertRuleMock = vi.fn();
const deleteAlertRuleMock = vi.fn();
const listAlertRulesMock = vi.fn();
const listPropertiesMock = vi.fn();

vi.mock("@/services/alert-rules/alert-rules.service", () => ({
    createAlertRule: (payload: Record<string, unknown>) => createAlertRuleMock(payload),
    deleteAlertRule: (id: string) => deleteAlertRuleMock(id),
    listAlertRules: () => listAlertRulesMock(),
}));

vi.mock("@/services/properties/properties.service", () => ({
    listProperties: () => listPropertiesMock(),
}));

const renderAlertsPage = (): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <AlertsPage />
            </ToastProvider>
        </QueryClientProvider>,
    );
};

describe("AlertsPage", () => {
    beforeEach(() => {
        createAlertRuleMock.mockReset();
        deleteAlertRuleMock.mockReset();
        listAlertRulesMock.mockReset();
        listPropertiesMock.mockReset();

        listAlertRulesMock.mockResolvedValue([]);
        listPropertiesMock.mockResolvedValue([{ id: "prop_1", label: "Sunny flat", url: "https://example.com/listing" }]);
    });

    it("uses the standardized create-alert terminology", async () => {
        renderAlertsPage();

        fireEvent.click(await screen.findByRole("button", { name: "New alert" }));

        expect(screen.getByRole("heading", { name: "Create alert" })).toBeInTheDocument();
        expect(screen.getAllByRole("combobox")[1]).toBeInTheDocument();

        fireEvent.change(screen.getAllByRole("combobox")[1] as HTMLSelectElement, { target: { value: "price_below" } });

        expect(await screen.findByRole("spinbutton")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create alert" })).toBeInTheDocument();
    });

    it("shows inline feedback when alert creation fails", async () => {
        createAlertRuleMock.mockRejectedValue(new Error("boom"));

        renderAlertsPage();

        fireEvent.click(await screen.findByRole("button", { name: "New alert" }));
        fireEvent.change(screen.getAllByRole("combobox")[0] as HTMLSelectElement, { target: { value: "prop_1" } });
        fireEvent.click(screen.getByRole("button", { name: "Create alert" }));

        expect(await screen.findByText("Could not save the alert rule.")).toBeInTheDocument();
        await waitFor(() => {
            expect(createAlertRuleMock).toHaveBeenCalledWith({
                property_id: "prop_1",
                rule_type: "price_drop",
                threshold_amount: undefined,
            });
        });
    });
});
