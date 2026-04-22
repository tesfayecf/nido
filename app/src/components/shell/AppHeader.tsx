import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { useShellStore } from "@/stores/shell.store";

interface RouteMeta {
    readonly description: string;
    readonly section: string;
    readonly title: string;
}

const routeMeta: readonly [RegExp, RouteMeta][] = [
    [/^\/properties\/[^/]+$/, { description: "Read the latest tracked state and open edits only when needed.", section: "Properties", title: "Property" }],
    [/^\/properties(?:\/new)?$/, { description: "Track properties in a dense table with explicit actions.", section: "Properties", title: "Properties" }],
    [/^\/events$/, { description: "Watch live backoffice activity in one focused stream.", section: "Events", title: "Events" }],
    [/^\/sources(?:\/.*)?$/, { description: "Manage reusable extraction templates with compact detail views.", section: "Sources", title: "Sources" }],
    [/^\/runs(?:\/.*)?$/, { description: "Inspect extraction history, trigger new runs, and remove stale snapshots.", section: "Runs", title: "Runs" }],
    [/^\/bookmarks$/, { description: "Review the properties you have explicitly bookmarked for follow-up.", section: "Bookmarks", title: "Bookmarks" }],
    [/^\/alerts$/, { description: "Configure property-level alert rules that react to new runs.", section: "Alerts", title: "Alerts" }],
    [/^\/notifications$/, { description: "Work through triggered property alerts and manage read state.", section: "Notifications", title: "Notifications" }],
    [/^\/login$/, { description: "Authenticate to unlock property tracking workflows.", section: "Access", title: "Sign In" }],
];

const defaultMeta: RouteMeta = {
    description: "Data-first tooling for tracked properties, sources, runs, and events.",
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
                    <Button
                        aria-label={"Toggle navigation"}
                        className={"app-shell__nav-toggle"}
                        onClick={toggleNavOpen}
                        variant={"secondary"}
                    >
                        {"Menu"}
                    </Button>
                </div>
            </div>
        </header>
    );
};
