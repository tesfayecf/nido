/**
 * File: app/src/components/ui/Button.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of Button and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @testing-library/react, vitest, @/components/ui/Button
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @testing-library/react
 * - vitest
 * - @/components/ui/Button
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

import { Button } from "@/components/ui/Button";

describe("Button", () => {
    it("renders a consistent loading state", () => {
        render(<Button isLoading loadingLabel={"Saving property"}>{"Save"}</Button>);
        const button = screen.getByRole("button", { name: /save/i });

        expect(button).toBeDisabled();
        expect(button).toHaveAttribute("aria-busy", "true");
        expect(screen.getByRole("status", { name: "Saving property" })).toBeInTheDocument();
    });

    it("preserves click handling when not loading", () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>{"Run now"}</Button>);

        fireEvent.click(screen.getByRole("button", { name: "Run now" }));

        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});
