import type { QueryClient } from "@tanstack/react-query";

import { useLiveEventsStore } from "@/stores/live-events.store";
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
    useLiveEventsStore.setState({ connectionState: "closed", items: [] });
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
