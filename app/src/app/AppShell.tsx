import { Outlet } from "react-router-dom";

import { AppNav } from "@/components/shell/AppNav";

/**
 * Renders the shared shell used by all non-auth routes.
 *
 * The shell keeps navigation, page framing, and the route outlet consistent
 * while feature modules control their own content and data fetching.
 */
export const AppShell = (): JSX.Element => {
    return (
        <div className={"app-shell"}>
            <AppNav />
            <main className={"app-shell__content"}>
                <Outlet />
            </main>
        </div>
    );
};