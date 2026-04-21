import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useNavigate } from "react-router-dom";

import { clearAuthenticatedState, hasActiveSession } from "@/lib/auth/session";
import { authKeys } from "@/services/auth/auth.keys";
import { getCurrentUser, logout } from "@/services/auth/auth.service";
import { useSessionStore } from "@/stores/session.store";
import { useShellStore } from "@/stores/shell.store";

interface NavSection {
    readonly items: readonly { label: string; to: string; }[];
    readonly title: string;
}

const authenticatedSections: readonly NavSection[] = [
    {
        items: [{ label: "Properties", to: "/properties" }],
        title: "Track",
    },
    {
        items: [
            { label: "Sources", to: "/sources" },
            { label: "Runs", to: "/runs" },
            { label: "Bookmarks", to: "/bookmarks" },
            { label: "Alerts", to: "/alerts" },
            { label: "Notifications", to: "/notifications" },
        ],
        title: "Manage",
    },
];

export const AppNav = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const setNavOpen = useShellStore((state) => state.setNavOpen);
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
                <div>
                    <span className={"app-nav__eyebrow"}>{"Property Tracker"}</span>
                    <h2>{"Home Searcher"}</h2>
                </div>
                <button
                    aria-label={"Close navigation"}
                    className={"button button--secondary app-nav__close"}
                    onClick={() => {
                        setNavOpen(false);
                    }}
                    type={"button"}
                >
                    {"Close"}
                </button>
            </div>

            <nav aria-label={"Primary"} className={"app-nav__sections"}>
                {authenticatedSections.map((section) => {
                    return (
                        <section className={"app-nav__section"} key={section.title}>
                            <p className={"app-nav__section-label"}>{section.title}</p>
                            <ul className={"app-nav__list"}>
                                {section.items.map((item) => {
                                    return (
                                        <li key={item.to}>
                                            <NavItem to={item.to}>{item.label}</NavItem>
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
                        <span className={"muted-copy"}>{"Sign in to manage tracked properties, runs, and notifications."}</span>
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
