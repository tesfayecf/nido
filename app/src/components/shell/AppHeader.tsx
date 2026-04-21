import { useLocation } from "react-router-dom";

import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useShellStore } from "@/stores/shell.store";

interface RouteMeta {
    readonly description: string;
    readonly section: string;
    readonly title: string;
}

const routeMeta: ReadonlyArray<[RegExp, RouteMeta]> = [
    [/^\/listings\/[^/]+$/, { description: "Inspect one listing without losing access to the market context.", section: "Explore", title: "Listing Detail" }],
    [/^\/listings$/, { description: "Search, compare, and monitor market activity with a focused analyst workflow.", section: "Explore", title: "Market Intelligence Explorer" }],
    [/^\/bookmarks$/, { description: "Review the listings you have explicitly saved for follow-up.", section: "Track", title: "Bookmarks" }],
    [/^\/watchlists$/, { description: "Maintain reusable saved searches that drive alerts and notifications.", section: "Track", title: "Watchlists" }],
    [/^\/alerts$/, { description: "Configure the backend rules that turn watchlist changes into actionable signals.", section: "Track", title: "Alert Rules" }],
    [/^\/notifications$/, { description: "Work through the latest ingestion-driven notifications with clear filters.", section: "Track", title: "Notifications" }],
    [/^\/properties(?:\/.*)?$/, { description: "Manage tracked property pages, selectors, and ingest schedules.", section: "Operate", title: "Tracked Properties" }],
    [/^\/backoffice\/sources(?:\/.*)?$/, { description: "Configure ingestion sources and monitor their operational state.", section: "Operate", title: "Sources" }],
    [/^\/backoffice\/runs(?:\/.*)?$/, { description: "Inspect ingestion runs and verify the health of recent backoffice activity.", section: "Operate", title: "Runs" }],
    [/^\/login$/, { description: "Authenticate to unlock personal tracking and backoffice workflows.", section: "Access", title: "Sign In" }],
];

const defaultMeta: RouteMeta = {
    description: "Use the workspace to inspect listings, saved searches, and ingestion activity.",
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

/**
 * Renders the responsive application header.
 *
 * @returns The shell header content.
 */
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
