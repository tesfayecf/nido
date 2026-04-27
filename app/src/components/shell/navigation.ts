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

export interface NavItem {
    readonly icon: IconName;
    readonly label: string;
    readonly to: string;
}

export interface NavSection {
    readonly items: readonly NavItem[];
    readonly title: string;
}

export const AUTHENTICATED_SECTIONS: readonly NavSection[] = [
    {
        items: [
            { icon: "search", label: "Properties", to: "/properties" },
            { icon: "history", label: "Market Analysis", to: "/analytics" },
            { icon: "bookmark", label: "Saved / Shortlist", to: "/bookmarks" },
            { icon: "play", label: "Alerts", to: "/alerts" },
        ],
        title: "Core workflow",
    },
    {
        items: [
            { icon: "home", label: "Portfolio Dashboard", to: "/dashboard" },
            { icon: "inbox", label: "Review Queue", to: "/triage" },
            { icon: "bell", label: "Notifications", to: "/notifications" },
        ],
        title: "Operations",
    },
    {
        items: [
            { icon: "settings", label: "Admin Console", to: "/admin" },
            { icon: "sources", label: "Sources", to: "/sources" },
            { icon: "history", label: "Runs", to: "/runs" },
            { icon: "bookmark", label: "Fields", to: "/fields" },
            { icon: "bookmark", label: "Tags", to: "/tags" },
        ],
        title: "Admin / Advanced",
    },
    {
        items: [
            { icon: "settings", label: "Settings", to: "/settings" },
        ],
        title: "Account",
    },
];

const routeMeta: readonly [RegExp, RouteMeta][] = [
    [/^\/dashboard$/, { section: "Operations", title: "Portfolio Dashboard" }],
    [/^\/triage$/, { section: "Operations", title: "Review Queue" }],
    [/^\/properties\/new$/, { section: "Properties", title: "New property" }],
    [/^\/properties\/[^/]+\/fields\/[^/]+\/analysis$/, { section: "Market Analysis", title: "Field analysis" }],
    [/^\/properties\/[^/]+$/, { section: "Properties", title: "Property detail" }],
    [/^\/properties$/, { section: "Properties", title: "Properties" }],
    [/^\/analytics$/, { section: "Market Analysis", title: "Market Analysis" }],
    [/^\/bookmarks$/, { section: "Saved / Shortlist", title: "Saved / Shortlist" }],
    [/^\/alerts$/, { section: "Alerts", title: "Alerts" }],
    [/^\/notifications$/, { section: "Operations", title: "Notifications" }],
    [/^\/fields$/, { section: "Admin / Advanced", title: "Fields" }],
    [/^\/sources\/new$/, { section: "Admin / Advanced", title: "New source" }],
    [/^\/sources\/[^/]+$/, { section: "Admin / Advanced", title: "Source detail" }],
    [/^\/sources$/, { section: "Admin / Advanced", title: "Sources" }],
    [/^\/runs\/[^/]+$/, { section: "Admin / Advanced", title: "Run detail" }],
    [/^\/runs$/, { section: "Admin / Advanced", title: "Runs" }],
    [/^\/tags$/, { section: "Admin / Advanced", title: "Tags" }],
    [/^\/settings$/, { section: "Account", title: "Settings" }],
    [/^\/admin$/, { section: "Admin / Advanced", title: "Admin Console" }],
    [/^\/login$/, { section: "Access", title: "Sign In" }],
];

const defaultMeta: RouteMeta = {
    section: "Properties",
    title: "Properties",
};

export const getRouteMeta = (pathname: string): RouteMeta => {
    for (const [matcher, meta] of routeMeta) {
        if (matcher.test(pathname)) {
            return meta;
        }
    }

    return defaultMeta;
};
