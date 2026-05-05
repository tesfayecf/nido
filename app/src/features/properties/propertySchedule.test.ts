/**
 * File: app/src/features/properties/propertySchedule.test.ts
 *
 * Purpose:
 * Validates the documented behavior of propertySchedule and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: vitest
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - vitest
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
 * - /app/docs/features/properties.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { describe, expect, it } from "vitest";

import {
    durationDraftFromSeconds,
    durationDraftToSeconds,
    formatDurationFromSeconds,
} from "@/features/properties/propertySchedule";

describe("propertySchedule", () => {
    it("converts saved seconds into structured duration drafts", () => {
        expect(durationDraftFromSeconds(3600)).toEqual({ unit: "hours", value: "1" });
        expect(durationDraftFromSeconds(900)).toEqual({ unit: "minutes", value: "15" });
        expect(durationDraftFromSeconds(45)).toEqual({ unit: "seconds", value: "45" });
    });

    it("converts structured duration drafts back into seconds", () => {
        expect(durationDraftToSeconds("5", "minutes")).toBe(300);
        expect(durationDraftToSeconds("2", "hours")).toBe(7200);
        expect(durationDraftToSeconds("", "minutes")).toBeNull();
    });

    it("formats scheduling summaries for the UI", () => {
        expect(formatDurationFromSeconds(300)).toBe("5 minutes");
        expect(formatDurationFromSeconds(undefined)).toBe("Manual only");
    });
});
