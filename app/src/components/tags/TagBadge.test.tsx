/**
 * File: app/src/components/tags/TagBadge.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of TagBadge and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @testing-library/react, vitest, @/components/tags/TagBadge
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @testing-library/react
 * - vitest
 * - @/components/tags/TagBadge
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

import { TagBadge } from "@/components/tags/TagBadge";

describe("TagBadge", () => {
    it("renders tag name with color", () => {
        const tag = {
            color: "#3b82f6",
            created_at: "2025-01-01",
            id: "tag1",
            name: "High Priority",
            updated_at: "2025-01-01",
        };

        render(<TagBadge tag={tag} />);

        expect(screen.getByLabelText("Tag: High Priority")).toBeInTheDocument();
        expect(screen.getByText("High Priority")).toBeInTheDocument();
    });

    it("renders tag with fallback color when color is empty", () => {
        const tag = {
            color: "",
            created_at: "2025-01-01",
            id: "tag2",
            name: "No Color",
            updated_at: "2025-01-01",
        };

        render(<TagBadge tag={tag} />);

        expect(screen.getByLabelText("Tag: No Color")).toBeInTheDocument();
        expect(screen.getByText("No Color")).toBeInTheDocument();
    });
});
