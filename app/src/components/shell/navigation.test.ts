/**
 * File: app/src/components/shell/navigation.test.ts
 *
 * Purpose:
 * Validates the documented behavior of navigation and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: vitest, @/components/shell/navigation
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - vitest
 * - @/components/shell/navigation
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
import { describe, expect, it } from "vitest";

import { AUTHENTICATED_SECTIONS, getRouteMeta } from "@/components/shell/navigation";

describe("navigation", () => {
    it("prioritizes the dashboard ahead of the properties list", () => {
        const coreItems = AUTHENTICATED_SECTIONS[0]?.items.map((item) => item.label) ?? [];

        expect(coreItems.indexOf("Dashboard")).toBeGreaterThan(-1);
        expect(coreItems.indexOf("Properties")).toBeGreaterThan(-1);
        expect(coreItems.indexOf("Dashboard")).toBeLessThan(coreItems.indexOf("Properties"));
    });

    it("falls back to dashboard metadata for unknown routes", () => {
        expect(getRouteMeta("/unexpected")).toEqual({ section: "Core", title: "Dashboard" });
    });
});
