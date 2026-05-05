/**
 * File: app/src/lib/auth/session.test.ts
 *
 * Purpose:
 * Validates the documented behavior of session and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @tanstack/react-query, vitest, @/lib/auth/session, @/services/auth/auth.keys, @/services/backoffice-runs/runs.keys, @/services/bookmarks/bookmarks.keys, @/services/properties/properties.keys, @/stores/session.store; additional imports omitted for brevity
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @tanstack/react-query
 * - vitest
 * - @/lib/auth/session
 * - @/services/auth/auth.keys
 * - @/services/backoffice-runs/runs.keys
 * - @/services/bookmarks/bookmarks.keys
 * - @/services/properties/properties.keys
 * - @/stores/session.store
 * - @/stores/shell.store
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
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import { clearAuthenticatedState, hasActiveSession } from "@/lib/auth/session";
import { authKeys } from "@/services/auth/auth.keys";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { propertyKeys } from "@/services/properties/properties.keys";
import { useSessionStore } from "@/stores/session.store";
import { useShellStore } from "@/stores/shell.store";

describe("session helpers", () => {
    beforeEach(() => {
        clearAuthenticatedState();
    });

    it("identifies active sessions using expiry and token state", () => {
        expect(hasActiveSession({ expiresAt: "2026-04-21T12:00:00Z", token: "token-123" }, Date.parse("2026-04-21T11:00:00Z"))).toBe(true);
        expect(hasActiveSession({ expiresAt: "2026-04-21T12:00:00Z", token: "token-123" }, Date.parse("2026-04-21T13:00:00Z"))).toBe(false);
        expect(hasActiveSession({ expiresAt: null, token: "token-123" })).toBe(false);
    });

    it("clears protected client and query state together", () => {
        const queryClient = new QueryClient();
        queryClient.setQueryData(authKeys.me(), { id: "user-1" });
        queryClient.setQueryData(bookmarkKeys.all(), [{ id: "bookmark-1" }]);
        queryClient.setQueryData(runKeys.list({ limit: 20, property_id: "" }), [{ id: "run-1" }]);
        queryClient.setQueryData(propertyKeys.list(), [{ id: "property-1" }]);

        useSessionStore.getState().setSession({
            expiresAt: "2026-04-21T12:00:00Z",
            token: "token-123",
        });
        useShellStore.getState().setNavOpen(false);

        clearAuthenticatedState(queryClient);

        expect(useSessionStore.getState().token).toBeNull();
        expect(useShellStore.getState().navOpen).toBe(true);
        expect(queryClient.getQueryData(authKeys.me())).toBeUndefined();
        expect(queryClient.getQueryData(bookmarkKeys.all())).toBeUndefined();
        expect(queryClient.getQueryData(runKeys.list({ limit: 20, property_id: "" }))).toBeUndefined();
        expect(queryClient.getQueryData(propertyKeys.list())).toEqual([{ id: "property-1" }]);
    });
});
