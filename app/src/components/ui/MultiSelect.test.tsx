/**
 * File: app/src/components/ui/MultiSelect.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of MultiSelect and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: react, @testing-library/react, vitest, @/components/ui/Field, @/components/ui/MultiSelect
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - react
 * - @testing-library/react
 * - vitest
 * - @/components/ui/Field
 * - @/components/ui/MultiSelect
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
import { useState } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Field } from "@/components/ui/Field";
import { MultiSelect } from "@/components/ui/MultiSelect";

const OPTIONS = [
    {
        description: "Highest urgency",
        label: <span><strong>{"Critical"}</strong>{" alerts"}</span>,
        value: "critical",
    },
    {
        description: "Informational",
        label: <span>{"Digest only"}</span>,
        value: "digest",
    },
];

const MultiSelectHarness = (): JSX.Element => {
    const [values, setValues] = useState<string[]>([]);

    return (
        <Field label={"Delivery channels"}>
            <MultiSelect onChange={setValues} options={OPTIONS} values={values} />
        </Field>
    );
};

describe("MultiSelect", () => {
    it("keeps the field label as the trigger name and supports rich labels in search and selection", () => {
        render(<MultiSelectHarness />);

        const trigger = screen.getByRole("button", { name: "Delivery channels" });
        fireEvent.click(trigger);

        fireEvent.change(screen.getByPlaceholderText("Search options"), { target: { value: "critical" } });
        fireEvent.click(screen.getByRole("option", { name: /critical alerts/i }));

        expect(screen.getByRole("button", { name: "Delivery channels" })).toHaveTextContent("Critical alerts");
    });

    it("closes on escape and returns focus to the trigger", () => {
        render(<MultiSelectHarness />);

        const trigger = screen.getByRole("button", { name: "Delivery channels" });
        fireEvent.click(trigger);
        expect(screen.getByRole("listbox")).toBeInTheDocument();

        fireEvent.keyDown(window, { key: "Escape" });

        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });
});