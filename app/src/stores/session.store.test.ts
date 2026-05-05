/**
 * File: app/src/stores/session.store.test.ts
 *
 * Purpose:
 * Validates the documented behavior of session.store and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: vitest, @/stores/session.store
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - vitest
 * - @/stores/session.store
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
 * - /app/docs/state-management.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session.store";

describe("session store", () => {
    beforeEach(() => {
        useSessionStore.getState().clearSession();
    });

    it("stores and clears the bearer snapshot", () => {
        useSessionStore.getState().setSession({
            expiresAt: "2026-04-21T12:00:00Z",
            token: "token-123",
        });

        expect(useSessionStore.getState().token).toBe("token-123");
        expect(useSessionStore.getState().expiresAt).toBe("2026-04-21T12:00:00Z");

        useSessionStore.getState().clearSession();

        expect(useSessionStore.getState().token).toBeNull();
        expect(useSessionStore.getState().expiresAt).toBeNull();
    });
});