/**
 * File: app/src/components/shell/navigation.ts
 *
 * Purpose:
 * Provides shell navigation, header, theme, or workspace chrome used around authenticated pages.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Module imports, constants, browser APIs, or caller-provided parameters as declared below
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - TypeScript compiler
 * - Vite module graph
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
 * - /app/docs/components.md
 * - /app/docs/ui-architecture.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
interface RouteMeta {
    readonly section: string;
    readonly title: string;
}

type IconName =
    | "bell"
    | "bookmark"
    | "clock"
    | "history"
    | "home"
    | "inbox"
    | "play"
    | "search"
    | "settings"
    | "sources";

/**
 * Documents the NavItem type contract used by app/src/components/shell/navigation.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface NavItem {
    readonly icon: IconName;
    readonly label: string;
    readonly to: string;
}

/**
 * Documents the NavSection type contract used by app/src/components/shell/navigation.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface NavSection {
    readonly items: readonly NavItem[];
    readonly title: string;
}

export const AUTHENTICATED_SECTIONS: readonly NavSection[] = [
    {
        items: [
            { icon: "home", label: "Dashboard", to: "/dashboard" },
            { icon: "search", label: "Properties", to: "/properties" },
            { icon: "history", label: "Market Analysis", to: "/analytics" },
            { icon: "bookmark", label: "Bookmarks", to: "/bookmarks" },
        ],
        title: "Core",
    },
    {
        items: [
            { icon: "inbox", label: "Review Queue", to: "/triage" },
            { icon: "play", label: "Alerts", to: "/alerts" },
            { icon: "bell", label: "Notifications", to: "/notifications" },
        ],
        title: "Operations",
    },
    {
        items: [
            { icon: "sources", label: "Sources", to: "/sources" },
            { icon: "history", label: "Runs", to: "/runs" },
            { icon: "bookmark", label: "Fields", to: "/fields" },
            { icon: "bookmark", label: "Tags", to: "/tags" },
        ],
        title: "Advanced",
    },
    {
        items: [
            { icon: "settings", label: "Settings", to: "/settings" },
        ],
        title: "Account",
    },
];

const routeMeta: readonly [RegExp, RouteMeta][] = [
    [/^\/dashboard$/, { section: "Core", title: "Dashboard" }],
    [/^\/triage$/, { section: "Operations", title: "Review Queue" }],
    [/^\/properties\/new$/, { section: "Properties", title: "New property" }],
    [/^\/properties\/[^/]+\/fields\/[^/]+\/analysis$/, { section: "Market Analysis", title: "Field analysis" }],
    [/^\/properties\/[^/]+$/, { section: "Properties", title: "Property detail" }],
    [/^\/properties$/, { section: "Properties", title: "Properties" }],
    [/^\/analytics$/, { section: "Core", title: "Market Analysis" }],
    [/^\/bookmarks$/, { section: "Core", title: "Bookmarks" }],
    [/^\/alerts$/, { section: "Operations", title: "Alerts" }],
    [/^\/notifications$/, { section: "Operations", title: "Notifications" }],
    [/^\/fields$/, { section: "Advanced", title: "Fields" }],
    [/^\/sources\/new$/, { section: "Advanced", title: "New source" }],
    [/^\/sources\/[^/]+$/, { section: "Advanced", title: "Source detail" }],
    [/^\/sources$/, { section: "Advanced", title: "Sources" }],
    [/^\/runs\/[^/]+$/, { section: "Advanced", title: "Run detail" }],
    [/^\/runs$/, { section: "Advanced", title: "Runs" }],
    [/^\/tags$/, { section: "Advanced", title: "Tags" }],
    [/^\/settings$/, { section: "Account", title: "Settings" }],
    [/^\/login$/, { section: "Access", title: "Sign In" }],
];

const defaultMeta: RouteMeta = {
    section: "Core",
    title: "Dashboard",
};

/**
 * Purpose: Executes the getRouteMeta operation for app/src/components/shell/navigation.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const getRouteMeta = (pathname: string): RouteMeta => {
    for (const [matcher, meta] of routeMeta) {
        if (matcher.test(pathname)) {
            return meta;
        }
    }

    return defaultMeta;
};
