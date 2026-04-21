import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useNavigate } from "react-router-dom";

import { clearAuthenticatedState, hasActiveSession } from "@/lib/auth/session";
import { authKeys } from "@/services/auth/auth.keys";
import { getCurrentUser, logout } from "@/services/auth/auth.service";
import { useSessionStore } from "@/stores/session.store";

/**
 * Renders the primary application navigation.
 *
 * Navigation is intentionally dense and sectioned so iteration 1 can expose the
 * explorer, personal tracking, and backoffice surfaces without excessive UI
 * scaffolding.
 */
export const AppNav = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
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
        <aside className={"app-nav"}>
            <div className={"app-nav__brand"}>
                <span className={"app-nav__eyebrow"}>{"Market Workspace"}</span>
                <h1>{"Home Searcher"}</h1>
            </div>

            <nav className={"app-nav__sections"}>
                <div>
                    <p className={"app-nav__section-label"}>{"Explore"}</p>
                    <NavItem to={"/listings"}>{"Listings"}</NavItem>
                </div>

                {isAuthenticated ? (
                    <>
                        <div>
                            <p className={"app-nav__section-label"}>{"Track"}</p>
                            <NavItem to={"/bookmarks"}>{"Bookmarks"}</NavItem>
                            <NavItem to={"/watchlists"}>{"Watchlists"}</NavItem>
                            <NavItem to={"/alerts"}>{"Alerts"}</NavItem>
                            <NavItem to={"/notifications"}>{"Notifications"}</NavItem>
                        </div>

                        <div>
                            <p className={"app-nav__section-label"}>{"Operate"}</p>
                            <NavItem to={"/backoffice/sources"}>{"Sources"}</NavItem>
                            <NavItem to={"/backoffice/runs"}>{"Runs"}</NavItem>
                        </div>
                    </>
                ) : null}
            </nav>

            <div className={"app-nav__footer"}>
                {isAuthenticated ? (
                    <>
                        <div className={"app-nav__identity"}>
                            <span className={"app-nav__section-label"}>{"Signed in"}</span>
                            <strong>{meQuery.data?.display_name ?? "Authenticated user"}</strong>
                            <span className={"muted-copy"}>{meQuery.data?.email ?? "Loading profile..."}</span>
                        </div>
                        <button
                            className={"button button--secondary"}
                            disabled={logoutMutation.isPending}
                            onClick={() => {
                                logoutMutation.mutate();
                            }}
                            type={"button"}
                        >
                            {logoutMutation.isPending ? "Signing out..." : "Sign out"}
                        </button>
                    </>
                ) : (
                    <div className={"app-nav__identity"}>
                        <span className={"muted-copy"}>{"Personal tracking and backoffice flows require a bearer session."}</span>
                        <NavLink className={"button"} to={"/login"}>{"Sign in"}</NavLink>
                    </div>
                )}
            </div>
        </aside>
    );
};

interface NavItemProps {
    readonly children: string;
    readonly to: string;
}

/**
 * Renders one navigation link with active-state styling.
 *
 * @param props The navigation item properties.
 * @returns One navigation link.
 */
const NavItem = ({ children, to }: NavItemProps): JSX.Element => {
    return (
        <NavLink
            className={({ isActive }) => {
                return isActive ? "app-nav__link app-nav__link--active" : "app-nav__link";
            }}
            to={to}
        >
            {children}
        </NavLink>
    );
};