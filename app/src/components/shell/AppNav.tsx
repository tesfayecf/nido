/**
 * File: app/src/components/shell/AppNav.tsx
 *
 * Purpose:
 * Provides shell navigation, header, theme, or workspace chrome used around authenticated pages.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: @tanstack/react-query, react-router-dom, @/components/ui/Button, @/components/ui/Icon, @/components/shell/navigation, @/lib/auth/session, @/services/auth/auth.keys, @/services/auth/auth.service; additional imports omitted for brevity
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - @tanstack/react-query
 * - react-router-dom
 * - @/components/ui/Button
 * - @/components/ui/Icon
 * - @/components/shell/navigation
 * - @/lib/auth/session
 * - @/services/auth/auth.keys
 * - @/services/auth/auth.service
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
 * - /app/docs/components.md
 * - /app/docs/ui-architecture.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { AUTHENTICATED_SECTIONS } from "@/components/shell/navigation";
import { clearAuthenticatedState, hasActiveSession } from "@/lib/auth/session";
import { authKeys } from "@/services/auth/auth.keys";
import { getCurrentUser, logout } from "@/services/auth/auth.service";
import { useSessionStore } from "@/stores/session.store";
import { useShellStore } from "@/stores/shell.store";

/**
 * Purpose: Renders the AppNav UI boundary documented for app/src/components/shell/AppNav.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const AppNav = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const navCollapsed = useShellStore((state) => state.navCollapsed);
    const expiresAt = useSessionStore((state) => state.expiresAt);
    const token = useSessionStore((state) => state.token);
    const isAuthenticated = hasActiveSession({ expiresAt, token });
    const meQuery = useQuery({
        enabled: isAuthenticated,
        queryFn: getCurrentUser,
        queryKey: authKeys.me(),
        staleTime: 60_000,
    });
    const logoutMutation = useMutation({
        mutationFn: logout,
        onSettled() {
            clearAuthenticatedState(queryClient);
            void navigate("/login");
        },
    });

    return (
        <aside className={navCollapsed ? "app-nav app-nav--collapsed" : "app-nav"}>
            <div className={"app-nav__brand"}>
                <span aria-hidden className={"app-nav__brand-mark"}>{"N"}</span>
                <div className={"app-nav__brand-copy"}>
                    <span className={"app-nav__eyebrow"}>{"Acquisition workspace"}</span>
                </div>
            </div>

            <nav aria-label={"Primary"} className={"app-nav__sections"}>
                {AUTHENTICATED_SECTIONS.map((section) => {
                    return (
                        <section className={"app-nav__section"} key={section.title}>
                            <p className={"app-nav__section-label"}>{section.title}</p>
                            <ul className={"app-nav__list"}>
                                {section.items.map((item) => {
                                    return (
                                        <li key={item.to}>
                                            <NavItemLink icon={item.icon} label={item.label} to={item.to} />
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    );
                })}
            </nav>

            <div className={"app-nav__footer"}>
                {isAuthenticated ? (
                    <>
                        <div className={"app-nav__identity"} title={meQuery.data?.email ?? ""}>
                            <span aria-hidden className={"app-nav__avatar"}>
                                {(meQuery.data?.display_name ?? "?").trim().charAt(0).toUpperCase()}
                            </span>
                            <div className={"app-nav__identity-copy"}>
                                <strong>{meQuery.data?.display_name ?? "Authenticated user"}</strong>
                                <span className={"muted-copy"}>{meQuery.data?.email ?? "Loading profile..."}</span>
                            </div>
                        </div>
                        <Button
                            disabled={logoutMutation.isPending}
                            onClick={() => {
                                logoutMutation.mutate();
                            }}
                            variant={"secondary"}
                        >
                            {logoutMutation.isPending ? "Signing out..." : "Sign out"}
                        </Button>
                    </>
                ) : (
                    <div className={"app-nav__identity"}>
                        <span className={"muted-copy"}>{"Sign in to manage tracked properties, runs, and notifications."}</span>
                        <Button as={NavLink} to={"/login"}>{"Sign in"}</Button>
                    </div>
                )}
            </div>
        </aside>
    );
};

interface NavItemLinkProps {
    readonly icon: (typeof AUTHENTICATED_SECTIONS)[number]["items"][number]["icon"];
    readonly label: string;
    readonly to: string;
}

const NavItemLink = ({ icon, label, to }: NavItemLinkProps): JSX.Element => {
    return (
        <NavLink
            className={({ isActive }) => {
                return isActive ? "app-nav__link app-nav__link--active" : "app-nav__link";
            }}
            title={label}
            to={to}
        >
            <Icon className={"app-nav__link-icon"} name={icon} />
            <span className={"app-nav__link-label"}>{label}</span>
        </NavLink>
    );
};
