import { useLocation } from "react-router-dom";

import { CommandPalette } from "@/features/operators/CommandPalette";
import { Icon } from "@/components/ui/Icon";
import { useShellStore } from "@/stores/shell.store";

interface RouteMeta {
    readonly section: string;
    readonly title: string;
}

const routeMeta: readonly [RegExp, RouteMeta][] = [
    [/^\/dashboard$/, { section: "Workspace", title: "Dashboard" }],
    [/^\/triage$/, { section: "Workspace", title: "Triage inbox" }],
    [/^\/properties\/new$/, { section: "Properties", title: "New property" }],
    [/^\/properties\/[^/]+$/, { section: "Properties", title: "Property" }],
    [/^\/properties$/, { section: "Properties", title: "Properties" }],
    [/^\/events$/, { section: "Events", title: "Events" }],
    [/^\/sources\/new$/, { section: "Sources", title: "New source" }],
    [/^\/sources\/[^/]+$/, { section: "Sources", title: "Source" }],
    [/^\/sources$/, { section: "Sources", title: "Sources" }],
    [/^\/runs\/[^/]+$/, { section: "Runs", title: "Run" }],
    [/^\/runs$/, { section: "Runs", title: "Runs" }],
    [/^\/bookmarks$/, { section: "Bookmarks", title: "Bookmarks" }],
    [/^\/alerts$/, { section: "Alerts", title: "Alerts" }],
    [/^\/notifications$/, { section: "Notifications", title: "Notifications" }],
    [/^\/login$/, { section: "Access", title: "Sign In" }],
    [/^\/settings$/, { section: "Account", title: "Settings" }],
    [/^\/admin$/, { section: "Platform", title: "Admin Console" }],
];

const defaultMeta: RouteMeta = {
    section: "Workspace",
    title: "Property Tracker",
};

const getRouteMeta = (pathname: string): RouteMeta => {
    for (const [matcher, meta] of routeMeta) {
        if (matcher.test(pathname)) {
            return meta;
        }
    }

    return defaultMeta;
};

export const AppHeader = (): JSX.Element => {
    const { pathname } = useLocation();
    const toggleNavCollapsed = useShellStore((state) => state.toggleNavCollapsed);
    const toggleNavOpen = useShellStore((state) => state.toggleNavOpen);
    const meta = getRouteMeta(pathname);

    const handleSidebarToggle = (): void => {
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 960px)").matches) {
            toggleNavOpen();
            return;
        }

        toggleNavCollapsed();
    };

    return (
        <header className={"app-shell__header"}>
            <div className={"app-shell__header-row"}>
                <button
                    aria-label={"Toggle sidebar"}
                    className={"icon-button app-shell__sidebar-toggle"}
                    onClick={handleSidebarToggle}
                    type={"button"}
                >
                    <Icon name={"sidebar"} />
                </button>
                <div className={"app-shell__header-copy"}>
                    <span className={"app-shell__breadcrumb"}>{meta.section}</span>
                    <span aria-hidden className={"app-shell__breadcrumb-sep"}>{"/"}</span>
                    <h1 className={"app-shell__page-title"}>{meta.title}</h1>
                </div>
                <div className={"app-shell__header-actions"}>
                    <CommandPalette />
                </div>
            </div>
        </header>
    );
};
