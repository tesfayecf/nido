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
            { icon: "home", label: "Dashboard", to: "/dashboard" },
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
