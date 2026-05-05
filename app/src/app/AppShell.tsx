/**
 * File: app/src/app/AppShell.tsx
 *
 * Purpose:
 * Renders the authenticated application shell, navigation frame, and nested route outlet.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, react-router-dom, @/components/shell/AppHeader, @/components/shell/AppNav, @/features/settings/weeklyDigest, @/stores/shell.store
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - react-router-dom
 * - @/components/shell/AppHeader
 * - @/components/shell/AppNav
 * - @/features/settings/weeklyDigest
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
import { useEffect } from "react";

import { Outlet, useLocation } from "react-router-dom";

import { AppHeader } from "@/components/shell/AppHeader";
import { AppNav } from "@/components/shell/AppNav";
import { useWeeklyDigest } from "@/features/settings/weeklyDigest";
import { useShellStore } from "@/stores/shell.store";

/**
 * Renders the shared shell used by all non-auth routes.
 *
 * The shell keeps navigation, page framing, and the route outlet consistent
 * while feature modules control their own content and data fetching.
 */
export const AppShell = (): JSX.Element => {
    useWeeklyDigest();
    const location = useLocation();
    const navOpen = useShellStore((state) => state.navOpen);
    const navCollapsed = useShellStore((state) => state.navCollapsed);
    const setNavOpen = useShellStore((state) => state.setNavOpen);

    useEffect(() => {
        if (window.matchMedia("(max-width: 960px)").matches) {
            setNavOpen(false);
        }
    }, [location.pathname, setNavOpen]);

    const shellClassName = [
        "app-shell",
        navOpen ? "app-shell--nav-open" : null,
        navCollapsed ? "app-shell--nav-collapsed" : null,
    ].filter(Boolean).join(" ");

    return (
        <>
            <a className={"skip-link"} href={"#main-content"}>{"Skip to main content"}</a>
            <div className={shellClassName}>
                <button
                    aria-hidden={!navOpen}
                    className={"app-shell__backdrop"}
                    onClick={() => {
                        setNavOpen(false);
                    }}
                    tabIndex={navOpen ? 0 : -1}
                    type={"button"}
                />
                <div className={"app-shell__sidebar"}>
                    <AppNav />
                </div>
                <div className={"app-shell__panel"}>
                    <AppHeader />
                    <main className={"app-shell__content"} id={"main-content"} tabIndex={-1}>
                        <Outlet />
                    </main>
                </div>
            </div>
        </>
    );
};
