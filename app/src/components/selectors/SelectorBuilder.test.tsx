/**
 * File: app/src/components/selectors/SelectorBuilder.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of SelectorBuilder and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @testing-library/react, vitest, @/components/selectors/SelectorBuilder, @/features/selectors/selectorSchema, @/services/fields/fields.types
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @testing-library/react
 * - vitest
 * - @/components/selectors/SelectorBuilder
 * - @/features/selectors/selectorSchema
 * - @/services/fields/fields.types
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
 * - /app/docs/components.md
 * - /app/docs/ui-architecture.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SelectorBuilder } from "@/components/selectors/SelectorBuilder";
import { createDefaultSelectorDrafts } from "@/features/selectors/selectorSchema";
import type { FieldDefinitionUsage } from "@/services/fields/fields.types";

const FIELD_DEFINITIONS: FieldDefinitionUsage[] = [
    {
        created_at: "2024-01-01T00:00:00Z",
        data_type: "number",
        display_name: "Price",
        id: "field-price",
        name: "price",
        properties_using: 2,
        system_defined: true,
        updated_at: "2024-01-01T00:00:00Z",
        value_count: 10,
    },
];

describe("SelectorBuilder", () => {
    it("opens a help popup with selector guidance", () => {
        render(<SelectorBuilder fields={createDefaultSelectorDrafts()} onChange={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "How to use" }));

        expect(screen.getByRole("dialog", { name: "How to use the selector tool" })).toBeInTheDocument();
        expect(screen.getByText("Recommended workflow")).toBeInTheDocument();
        expect(screen.getByText(/Start with a simple CSS selector/i)).toBeInTheDocument();
        expect(screen.getByText(/Use CSS first/i)).toBeInTheDocument();
        expect(screen.getByText(/If Preview says no selector matched/i)).toBeInTheDocument();
    });

    it("closes the help popup", () => {
        render(<SelectorBuilder fields={createDefaultSelectorDrafts()} onChange={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "How to use" }));
        fireEvent.click(screen.getByRole("button", { name: "Got it" }));

        expect(screen.queryByRole("dialog", { name: "How to use the selector tool" })).not.toBeInTheDocument();
    });

    it("shows canonical field assignment options", () => {
        render(<SelectorBuilder fieldDefinitions={FIELD_DEFINITIONS} fields={createDefaultSelectorDrafts()} onChange={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: /price/i }));

        expect(screen.getAllByRole("combobox")[0]).toHaveValue("tracked");
        expect(screen.getAllByRole("combobox")[1]).toHaveValue("price");
        expect(screen.getAllByRole("option", { name: "Price" }).length).toBeGreaterThan(0);
    });
});
