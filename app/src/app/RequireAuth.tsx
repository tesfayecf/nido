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

    if (!hasActiveSession({ expiresAt, token })) {
        clearAuthenticatedClientState();
        const redirect = `${location.pathname}${location.search}`;
        return <Navigate replace to={`/login?redirect=${encodeURIComponent(redirect)}`} />;
    }

    return <Outlet />;
};