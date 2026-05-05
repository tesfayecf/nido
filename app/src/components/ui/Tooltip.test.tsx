/**
 * File: app/src/components/ui/Tooltip.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of Tooltip and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @testing-library/react, vitest, @/components/ui/Tooltip
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @testing-library/react
 * - vitest
 * - @/components/ui/Tooltip
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
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tooltip } from "@/components/ui/Tooltip";

describe("Tooltip", () => {
    it("associates tooltip content with an interactive trigger without adding an extra tab stop", () => {
        const { container } = render(
            <Tooltip content={"Retry details"}>
                <button type={"button"}>{"Run now"}</button>
            </Tooltip>,
        );

        const trigger = screen.getByRole("button", { name: "Run now" });
        const tooltip = screen.getByRole("tooltip");

        expect(trigger).toHaveAttribute("aria-describedby", tooltip.getAttribute("id"));
        expect(container.querySelector('.tooltip__trigger[tabindex="0"]')).toBeNull();
    });

    it("creates a focusable wrapper when the child is not already an element", () => {
        render(<Tooltip content={"More context"}>{"Status"}</Tooltip>);

        const tooltip = screen.getByRole("tooltip");
        const wrapper = document.querySelector<HTMLElement>(".tooltip__trigger");

        expect(wrapper).not.toBeNull();
        expect(wrapper).toHaveAttribute("tabindex", "0");
        expect(wrapper).toHaveAttribute("aria-describedby", tooltip.getAttribute("id"));
    });
});