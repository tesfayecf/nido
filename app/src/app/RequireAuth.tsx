/**
 * File: app/src/app/RequireAuth.tsx
 *
 * Purpose:
 * Defines the frontend behavior owned by app/RequireAuth.tsx.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, react-router-dom, @/lib/auth/session, @/stores/session.store
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - react-router-dom
 * - @/lib/auth/session
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
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { useEffect, useRef } from "react";

import { Navigate, Outlet, useLocation } from "react-router-dom";

import { clearAuthenticatedClientState, hasActiveSession } from "@/lib/auth/session";
import { useSessionStore } from "@/stores/session.store";

/**
 * Protects authenticated routes.
 *
 * @returns The child route outlet when a token exists, otherwise a redirect to
 * the login page with the original location preserved.
 */
export const RequireAuth = (): JSX.Element => {
    const location = useLocation();
    const expiresAt = useSessionStore((state) => state.expiresAt);
    const token = useSessionStore((state) => state.token);
    const isAuthenticated = hasActiveSession({ expiresAt, token });
    const previousAuthState = useRef<boolean | null>(null);

    useEffect(() => {
        if (!isAuthenticated && previousAuthState.current !== false) {
            clearAuthenticatedClientState();
        }

        previousAuthState.current = isAuthenticated;
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        const redirect = `${location.pathname}${location.search}`;
        return <Navigate replace to={`/login?redirect=${encodeURIComponent(redirect)}`} />;
    }

    return <Outlet />;
};
