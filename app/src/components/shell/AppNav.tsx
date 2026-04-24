import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { clearAuthenticatedState, hasActiveSession } from "@/lib/auth/session";
import { authKeys } from "@/services/auth/auth.keys";
import { getCurrentUser, logout } from "@/services/auth/auth.service";
import { useSessionStore } from "@/stores/session.store";
import { useShellStore } from "@/stores/shell.store";

type IconName =
    | "bell"
    | "bookmark"
    | "chart"
    | "clock"
    | "home"
    | "history"
    | "inbox"
    | "play"
    | "search"
    | "settings"
    | "sources";

interface NavItem {
    readonly icon: IconName;
    readonly label: string;
    readonly to: string;
}

interface NavSection {
    readonly items: readonly NavItem[];
    readonly title: string;
}

const authenticatedSections: readonly NavSection[] = [
    {
        items: [
            { icon: "home", label: "Dashboard", to: "/dashboard" },
            { icon: "inbox", label: "Triage", to: "/triage" },
            { icon: "search", label: "Properties", to: "/properties" },
            { icon: "chart", label: "Analytics", to: "/analytics" },
            { icon: "clock", label: "Events", to: "/events" },
            { icon: "sources", label: "Sources", to: "/sources" },
            { icon: "history", label: "Runs", to: "/runs" },
            { icon: "bookmark", label: "Tags", to: "/tags" },
        ],
        title: "Workspace",
    },
    {
        items: [
            { icon: "bookmark", label: "Bookmarks", to: "/bookmarks" },
            { icon: "play", label: "Alerts", to: "/alerts" },
            { icon: "bell", label: "Notifications", to: "/notifications" },
        ],
        title: "Engagement",
    },
    {
        items: [
            { icon: "settings", label: "Settings", to: "/settings" },
            { icon: "settings", label: "Admin", to: "/admin" },
        ],
        title: "Account",
    },
];

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
                <span aria-hidden className={"app-nav__brand-mark"}>{"H"}</span>
                <div className={"app-nav__brand-copy"}>
                    <span className={"app-nav__eyebrow"}>{"Property Tracker"}</span>
                </div>
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
                        <div className={"app-nav__user-controls"}>
                            <Button as={NavLink} to={"/settings"} variant={"secondary"}>{"Settings"}</Button>
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
    readonly icon: IconName;
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
