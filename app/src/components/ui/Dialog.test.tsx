/**
 * File: app/src/components/ui/Dialog.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of Dialog and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @testing-library/react, vitest, @/components/ui/Dialog
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @testing-library/react
 * - vitest
 * - @/components/ui/Dialog
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

import { Dialog } from "@/components/ui/Dialog";

describe("Dialog", () => {
    it("closes when escape is pressed", () => {
        const handleOpenChange = vi.fn();
        render(
            <Dialog onOpenChange={handleOpenChange} open title={"Filters"}>
                <button type={"button"}>{"Focusable child"}</button>
            </Dialog>,
        );

        fireEvent.keyDown(window, { key: "Escape" });

        expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it("renders content inside an accessible dialog", () => {
        render(
            <Dialog description={"Refine results"} onOpenChange={vi.fn()} open title={"Filters"}>
                <p>{"Dialog body"}</p>
            </Dialog>,
        );

        expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
        expect(screen.getByText("Dialog body")).toBeInTheDocument();
    });

    it("focuses the requested primary target when one is provided", () => {
        render(
            <Dialog initialFocusSelector={"[data-dialog-primary='true']"} onOpenChange={vi.fn()} open title={"Confirm change"}>
                <button type={"button"}>{"Cancel"}</button>
                <button data-dialog-primary={"true"} type={"button"}>{"Confirm"}</button>
            </Dialog>,
        );

        expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
    });
});
