/**
 * File: app/src/components/ui/Field.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of Field and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @testing-library/react, vitest, @/components/ui/Field, @/components/ui/Input
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @testing-library/react
 * - vitest
 * - @/components/ui/Field
 * - @/components/ui/Input
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
import { describe, expect, it } from "vitest";

import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

describe("Field", () => {
    it("keeps helper copy hidden until the user requests it", () => {
        render(
            <Field hint={"Enter a stable locale such as en-IE or es-ES."} label={"Display locale"}>
                <Input type={"text"} />
            </Field>,
        );

        expect(screen.getByLabelText("Display locale")).toBeInTheDocument();
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Show help for Display locale" }));

        expect(screen.getByRole("tooltip")).toHaveTextContent("Enter a stable locale such as en-IE or es-ES.");
    });
});
