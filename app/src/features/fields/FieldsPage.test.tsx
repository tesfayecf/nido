/**
 * File: app/src/features/fields/FieldsPage.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of FieldsPage and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @tanstack/react-query, @testing-library/react, react-router-dom, vitest, @/components/ui/ToastProvider, @/features/fields/FieldsPage
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @tanstack/react-query
 * - @testing-library/react
 * - react-router-dom
 * - vitest
 * - @/components/ui/ToastProvider
 * - @/features/fields/FieldsPage
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
 * - /app/docs/features/fields.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
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