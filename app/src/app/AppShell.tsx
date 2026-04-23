import { useEffect } from "react";

import { Outlet, useLocation } from "react-router-dom";

import { AppHeader } from "@/components/shell/AppHeader";
import { AppNav } from "@/components/shell/AppNav";
import { useShellStore } from "@/stores/shell.store";

/**
 * Renders the shared shell used by all non-auth routes.
 *
 * The shell keeps navigation, page framing, and the route outlet consistent
 * while feature modules control their own content and data fetching.
 */
export const AppShell = (): JSX.Element => {
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
