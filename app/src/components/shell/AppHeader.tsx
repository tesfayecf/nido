import { useLocation } from "react-router-dom";

import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useShellStore } from "@/stores/shell.store";

interface RouteMeta {
    readonly description: string;
    readonly section: string;
    readonly title: string;
}

const routeMeta: readonly [RegExp, RouteMeta][] = [
    [/^\/properties\/[^/]+$/, { description: "Review the latest extracted data, source template, alerts, and run history for one property.", section: "Properties", title: "Property Detail" }],
    [/^\/properties(?:\/new)?$/, { description: "Add direct property URLs, assign source templates, bookmark what matters, and monitor the latest extraction state.", section: "Properties", title: "Tracked Properties" }],
    [/^\/sources(?:\/.*)?$/, { description: "Manage reusable extraction templates that properties can inherit or override.", section: "Sources", title: "Source Templates" }],
    [/^\/runs(?:\/.*)?$/, { description: "Inspect property extraction runs and their captured snapshot data.", section: "Runs", title: "Property Runs" }],
    [/^\/bookmarks$/, { description: "Review the properties you have explicitly bookmarked for follow-up.", section: "Bookmarks", title: "Bookmarks" }],
    [/^\/alerts$/, { description: "Configure property-level alert rules that react to new runs.", section: "Alerts", title: "Alerts" }],
    [/^\/notifications$/, { description: "Work through triggered property alerts and manage read state.", section: "Notifications", title: "Notifications" }],
    [/^\/login$/, { description: "Authenticate to unlock property tracking workflows.", section: "Access", title: "Sign In" }],
];

const defaultMeta: RouteMeta = {
    description: "Track specific properties, reusable source templates, runs, and property-level alerts.",
    section: "Workspace",
    title: "Home Searcher",
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
    const toggleNavOpen = useShellStore((state) => state.toggleNavOpen);
    const meta = getRouteMeta(pathname);

    return (
        <header className={"app-shell__header"}>
            <div className={"app-shell__header-row"}>
                <div className={"app-shell__header-copy"}>
                    <span className={"app-shell__eyebrow"}>{meta.section}</span>
                    <h1 className={"app-shell__page-title"}>{meta.title}</h1>
                    <p className={"app-shell__page-description"}>{meta.description}</p>
                </div>
                <div className={"app-shell__header-actions"}>
                    <button
                        aria-label={"Toggle navigation"}
                        className={"button button--secondary app-shell__nav-toggle"}
                        onClick={toggleNavOpen}
                        type={"button"}
                    >
                        {"Menu"}
                    </button>
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
};
