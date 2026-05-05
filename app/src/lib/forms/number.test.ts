/**
 * File: app/src/lib/forms/number.test.ts
 *
 * Purpose:
 * Validates the documented behavior of number and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: vitest, @/lib/forms/number
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - vitest
 * - @/lib/forms/number
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

import { parseOptionalNonNegativeInteger, readNonNegativeNumber } from "@/lib/forms/number";

describe("number helpers", () => {
    it("returns a fallback for invalid non-negative numbers", () => {
        expect(readNonNegativeNumber("42", 0)).toBe(42);
        expect(readNonNegativeNumber("-1", 8)).toBe(8);
        expect(readNonNegativeNumber("NaN", 8)).toBe(8);
    });

    it("parses optional non-negative integers safely", () => {
        expect(parseOptionalNonNegativeInteger("")).toBeUndefined();
        expect(parseOptionalNonNegativeInteger("120")).toBe(120);
        expect(parseOptionalNonNegativeInteger("-5")).toBeUndefined();
        expect(parseOptionalNonNegativeInteger("12.5")).toBeUndefined();
        expect(parseOptionalNonNegativeInteger("1e2")).toBe(100);
    });
});