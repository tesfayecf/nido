/**
 * File: app/src/lib/auth/session.ts
 *
 * Purpose:
 * Provides a shared frontend utility that centralizes cross-feature behavior.
 *
 * Responsibilities:
 * - Define typed frontend behavior for its module boundary
 * - Keep inputs and outputs explicit for maintainability
 * - Reference related modules so changes can be traced safely
 *
 * Inputs:
 * - Imports: @tanstack/react-query, @/stores/session.store, @/stores/shell.store
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - @tanstack/react-query
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
import type { QueryClient } from "@tanstack/react-query";

import { useSessionStore } from "@/stores/session.store";
import { useShellStore } from "@/stores/shell.store";

const PROTECTED_QUERY_ROOTS = new Set(["auth", "backoffice", "me"]);

interface SessionSnapshot {
    readonly expiresAt: string | null;
    readonly token: string | null;
}

/**
 * Determines whether the persisted bearer session is still valid.
 *
 * @param session The current persisted session snapshot.
 * @param now The current time in milliseconds.
 * @returns True when the session contains a token and a future expiry.
 */
export const hasActiveSession = (session: SessionSnapshot, now: number = Date.now()): boolean => {
    if (session.token === null || session.expiresAt === null) {
        return false;
    }

    const expiry = Date.parse(session.expiresAt);
    return Number.isFinite(expiry) && expiry > now;
};

/**
 * Clears client-side state that should never survive an auth boundary.
 */
export const clearAuthenticatedClientState = (): void => {
    useSessionStore.getState().clearSession();
    useShellStore.setState({ navOpen: true });
};

/**
 * Removes cached queries that belong to authenticated workflows.
 *
 * @param queryClient The active query client.
 */
export const clearAuthenticatedQueryState = (queryClient: QueryClient): void => {
    queryClient.removeQueries({
        predicate: (query) => {
            const [root] = query.queryKey;
            return typeof root === "string" && PROTECTED_QUERY_ROOTS.has(root);
        },
    });
};

/**
 * Clears authenticated client state and, when available, protected queries.
 *
 * @param queryClient The active query client.
 */
export const clearAuthenticatedState = (queryClient?: QueryClient): void => {
    clearAuthenticatedClientState();
    if (queryClient !== undefined) {
        clearAuthenticatedQueryState(queryClient);
    }
};
