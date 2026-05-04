import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { AlertsPage } from "@/features/engagement/AlertsPage";

const createAlertRuleMock = vi.fn();
const deleteAlertRuleMock = vi.fn();
const listAlertRulesMock = vi.fn();
const listPropertiesMock = vi.fn();
const TEST_TIMEOUT_MS = 30000;

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

        expect(await screen.findByLabelText("Alerts overview")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Create alert" }));

        const dialog = screen.getByRole("dialog", { name: "Create alert" });
        expect(within(dialog).getByRole("heading", { name: "Create alert" })).toBeInTheDocument();
        expect(within(dialog).getByRole("combobox", { name: "Rule type" })).toBeInTheDocument();

        fireEvent.change(within(dialog).getByRole("combobox", { name: "Rule type" }) as HTMLSelectElement, { target: { value: "price_below" } });

        expect(await screen.findByRole("spinbutton")).toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "Create alert" })).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);

    it("shows inline feedback when alert creation fails", async () => {
        createAlertRuleMock.mockRejectedValue(new Error("boom"));

        renderAlertsPage();

        fireEvent.click(await screen.findByRole("button", { name: "Create alert" }));
        const dialog = screen.getByRole("dialog", { name: "Create alert" });
        fireEvent.change(within(dialog).getByRole("combobox", { name: "Property" }) as HTMLSelectElement, { target: { value: "prop_1" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Create alert" }));

        expect(await screen.findByText("Could not save the alert rule.")).toBeInTheDocument();
        await waitFor(() => {
            expect(createAlertRuleMock).toHaveBeenCalledWith({
                property_id: "prop_1",
                rule_type: "price_drop",
                threshold_amount: undefined,
            });
        });
    }, TEST_TIMEOUT_MS);
});
