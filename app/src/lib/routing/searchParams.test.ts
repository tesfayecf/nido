/**
 * File: app/src/lib/routing/searchParams.test.ts
 *
 * Purpose:
 * Validates the documented behavior of searchParams and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: vitest, @/lib/routing/searchParams
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - vitest
 * - @/lib/routing/searchParams
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
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { describe, expect, it } from "vitest";

import { readBooleanParam, readNumberParam, readStringParam, writeParam } from "@/lib/routing/searchParams";

describe("searchParams helpers", () => {
    it("reads typed values with fallbacks", () => {
        const params = new URLSearchParams("q=bilbao&limit=25&unread_only=true");

        expect(readStringParam(params, "q")).toBe("bilbao");
        expect(readNumberParam(params, "limit", 10)).toBe(25);
        expect(readBooleanParam(params, "unread_only", false)).toBe(true);
        expect(readNumberParam(params, "missing", 10)).toBe(10);
    });

    it("writes and deletes params predictably", () => {
        const params = new URLSearchParams();

        writeParam(params, "q", "house");
        writeParam(params, "limit", 30);
        writeParam(params, "source_id", "");

        expect(params.get("q")).toBe("house");
        expect(params.get("limit")).toBe("30");
        expect(params.has("source_id")).toBe(false);
    });
});