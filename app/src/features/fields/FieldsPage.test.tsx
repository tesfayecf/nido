import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { FieldsPage } from "@/features/fields/FieldsPage";

const createFieldMock = vi.fn();
const deleteFieldMock = vi.fn();
const listFieldsMock = vi.fn();
const updateFieldMock = vi.fn();

vi.mock("@/services/fields/fields.service", () => ({
    createField: (payload: unknown) => createFieldMock(payload),
    deleteField: (id: string) => deleteFieldMock(id),
    listFields: () => listFieldsMock(),
    updateField: (fieldId: string, payload: unknown) => updateFieldMock(fieldId, payload),
}));

const TEST_TIMEOUT_MS = 30000;

const renderFieldsPage = (): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <ToastProvider>
                    <FieldsPage />
                </ToastProvider>
            </MemoryRouter>
        </QueryClientProvider>,
    );
};

describe("FieldsPage", () => {
    beforeEach(() => {
        createFieldMock.mockReset();
        deleteFieldMock.mockReset();
        listFieldsMock.mockReset();
        updateFieldMock.mockReset();
        listFieldsMock.mockResolvedValue([
            {
                comparison_operator: undefined,
                comparison_value: undefined,
                data_type: "number",
                default_value: undefined,
                description: "Listing price in EUR.",
                display_name: "Price",
                enum_values: undefined,
                id: "field_1",
                name: "price",
                properties_using: 12,
                unit: "EUR",
                use_default_when_missing: false,
                value_count: 42,
            },
        ]);
    });

    it("surfaces field coverage before the definitions table", async () => {
        renderFieldsPage();

        const overview = await screen.findByLabelText("Fields overview");

        expect(within(overview).getByText("In use")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create field" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Field definitions" })).toBeInTheDocument();
        expect(await screen.findByText("Price")).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);
});