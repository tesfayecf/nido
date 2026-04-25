import type { Notification } from "@/services/notifications/notifications.types";
import type { Run } from "@/services/backoffice-runs/runs.types";
import type { Property } from "@/services/properties/properties.types";
import type { Source } from "@/services/backoffice-sources/sources.types";

export type SavedViewId = "all" | "needs-review" | "failing-now" | "no-successful-run-yet" | "changed-recently" | "high-priority" | "bookmarked";
export type OperatorSeverity = "critical" | "high" | "medium" | "low";

export interface SavedViewOption {
    readonly description: string;
    readonly id: SavedViewId;
    readonly label: string;
}

export interface PropertyRunSummary {
    readonly failedCount: number;
    readonly hasSuccessfulRun: boolean;
    readonly latestRun?: Run;
}

export interface DashboardSummary {
    readonly changedRecently: Property[];
    readonly failedRunsLast24Hours: number;
    readonly nextScheduledRuns: Property[];
    readonly propertiesByStatus: Record<Property["status"], number>;
    readonly topProblemSources: readonly {
        readonly count: number;
        readonly sourceId: string;
        readonly sourceName: string;
    }[];
    readonly totalProperties: number;
    readonly unreadNotifications: number;
}

export interface TriageItem {
    readonly id: string;
    readonly actionLabel: string;
    readonly detail: string;
    readonly kind: "configuration" | "notification" | "property" | "run";
    readonly propertyId?: string;
    readonly runId?: string;
    readonly severity: OperatorSeverity;
    readonly sortAt: string;
    readonly title: string;
}

export const SAVED_VIEW_OPTIONS: readonly SavedViewOption[] = [
    {
        description: "Everything in the portfolio.",
        id: "all",
        label: "All properties",
    },
    {
        description: "Anything degraded, inactive, pending, or missing a healthy run.",
        id: "needs-review",
        label: "Needs review",
    },
    {
        description: "Recent failures and degraded properties.",
        id: "failing-now",
        label: "Failing now",
    },
    {
        description: "Tracked properties that have never recorded a successful run.",
        id: "no-successful-run-yet",
        label: "No successful run yet",
    },
    {
        description: "Recently updated tracked properties.",
        id: "changed-recently",
        label: "Changed recently",
    },
    {
        description: "Properties tagged as priority or urgent.",
        id: "high-priority",
        label: "High priority",
    },
    {
        description: "Bookmarked properties only.",
        id: "bookmarked",
        label: "Bookmarked",
    },
];

const HIGH_PRIORITY_TAG_TOKENS = ["high", "high-priority", "high priority", "p1", "priority", "urgent"];
const CHANGED_RECENTLY_HOURS = 72;
const RECENT_FAILURE_HOURS = 24;

export const compareDateDescending = (left: string | undefined, right: string | undefined): number => {
    return readDate(right) - readDate(left);
};

export const buildPropertyRunSummary = (runs: readonly Run[]): Map<string, PropertyRunSummary> => {
    const summary = new Map<string, PropertyRunSummary>();

    for (const run of runs) {
        const current = summary.get(run.property_id);
        const latestRun = current?.latestRun === undefined || readDate(run.observed_at) > readDate(current.latestRun.observed_at)
            ? run
            : current.latestRun;

        summary.set(run.property_id, {
            failedCount: (current?.failedCount ?? 0) + (isRunFailure(run) ? 1 : 0),
            hasSuccessfulRun: (current?.hasSuccessfulRun ?? false) || !isRunFailure(run),
            latestRun,
        });
    }

    return summary;
};

export const mergeBulkTagIds = (currentTagIds: readonly string[], bulkTagIds: readonly string[]): string[] => {
    return Array.from(new Set([...currentTagIds, ...bulkTagIds]));
};

export const retainVisibleSelection = (selectedPropertyIds: string[], visiblePropertyIds: readonly string[]): string[] => {
    const visibleIds = new Set(visiblePropertyIds);
    const nextSelection = selectedPropertyIds.filter((propertyId) => visibleIds.has(propertyId));

    if (nextSelection.length === selectedPropertyIds.length && nextSelection.every((propertyId, index) => propertyId === selectedPropertyIds[index])) {
        return selectedPropertyIds;
    }

    return nextSelection;
};

interface ApplySavedViewOptions {
    readonly bookmarkedIds: ReadonlySet<string>;
    readonly now?: Date;
    readonly propertyTagNamesById?: ReadonlyMap<string, readonly string[]>;
    readonly runSummaryByPropertyId?: ReadonlyMap<string, PropertyRunSummary>;
    readonly viewId: SavedViewId;
}

export const applySavedView = (properties: readonly Property[], options: ApplySavedViewOptions): Property[] => {
    const now = options.now ?? new Date();

    return properties.filter((property) => {
        const runSummary = options.runSummaryByPropertyId?.get(property.id);
        const hasRecentFailure = runSummary?.latestRun !== undefined && isRunFailure(runSummary.latestRun);
        const tagNames = options.propertyTagNamesById?.get(property.id) ?? [];

        switch (options.viewId) {
            case "needs-review":
                return property.status !== "active" || hasRecentFailure || !hasSuccessfulRun(property, runSummary);
            case "failing-now":
                return property.status === "degraded" || hasRecentFailure;
            case "no-successful-run-yet":
                return !hasSuccessfulRun(property, runSummary);
            case "changed-recently":
                return isWithinHours(property.updated_at, CHANGED_RECENTLY_HOURS, now);
            case "high-priority":
                return tagNames.some((tagName) => isHighPriorityTag(tagName));
            case "bookmarked":
                return options.bookmarkedIds.has(property.id);
            case "all":
            default:
                return true;
        }
    });
};

interface DashboardSummaryOptions {
    readonly bookmarks?: ReadonlySet<string>;
    readonly notifications: readonly Notification[];
    readonly now?: Date;
    readonly properties: readonly Property[];
    readonly runs: readonly Run[];
    readonly sources: readonly Source[];
}

export const buildDashboardSummary = ({ notifications, now = new Date(), properties, runs, sources }: DashboardSummaryOptions): DashboardSummary => {
    const sourceNameById = new Map(sources.map((source) => [source.id, source.name]));
    const sourceProblemCounts = new Map<string, number>();

    for (const property of properties) {
        if (property.source_id === undefined) {
            continue;
        }

        if (property.status === "degraded" || property.status === "inactive") {
            sourceProblemCounts.set(property.source_id, (sourceProblemCounts.get(property.source_id) ?? 0) + 1);
        }
    }

    for (const run of runs) {
        if (!isRunFailure(run)) {
            continue;
        }

        const sourceId = properties.find((property) => property.id === run.property_id)?.source_id;
        if (sourceId === undefined) {
            continue;
        }

        sourceProblemCounts.set(sourceId, (sourceProblemCounts.get(sourceId) ?? 0) + 1);
    }

    return {
        changedRecently: [...properties]
            .filter((property) => property.updated_at !== undefined)
            .sort((left, right) => compareDateDescending(left.updated_at, right.updated_at))
            .slice(0, 5),
        failedRunsLast24Hours: runs.filter((run) => isRunFailure(run) && isWithinHours(run.observed_at, RECENT_FAILURE_HOURS, now)).length,
        nextScheduledRuns: [...properties]
            .filter((property) => property.next_run_at !== undefined)
            .sort((left, right) => compareDateDescending(right.next_run_at, left.next_run_at))
            .slice(0, 5),
        propertiesByStatus: {
            active: properties.filter((property) => property.status === "active").length,
            degraded: properties.filter((property) => property.status === "degraded").length,
            inactive: properties.filter((property) => property.status === "inactive").length,
            pending: properties.filter((property) => property.status === "pending").length,
        },
        topProblemSources: [...sourceProblemCounts.entries()]
            .map(([sourceId, count]) => ({
                count,
                sourceId,
                sourceName: sourceNameById.get(sourceId) ?? sourceId,
            }))
            .sort((left, right) => right.count - left.count || left.sourceName.localeCompare(right.sourceName))
            .slice(0, 5),
        totalProperties: properties.length,
        unreadNotifications: notifications.filter((notification) => notification.read_at === undefined).length,
    };
};

interface BuildTriageItemsOptions {
    readonly notifications: readonly Notification[];
    readonly properties: readonly Property[];
    readonly runSummaryByPropertyId: ReadonlyMap<string, PropertyRunSummary>;
    readonly runs: readonly Run[];
}

export const buildTriageItems = ({ notifications, properties, runSummaryByPropertyId, runs }: BuildTriageItemsOptions): TriageItem[] => {
    const propertyById = new Map(properties.map((property) => [property.id, property]));

    const items: TriageItem[] = [
        ...properties
            .filter((property) => property.status !== "active")
            .map((property) => ({
                actionLabel: property.status === "degraded" ? "Open property" : "Review property",
                detail: property.status === "degraded" ? "Latest tracking state is degraded and likely needs intervention." : "This property is not in a healthy active state.",
                id: `property-${property.id}`,
                kind: "property" as const,
                propertyId: property.id,
                severity: property.status === "degraded" ? "high" as const : "medium" as const,
                sortAt: property.updated_at ?? property.created_at ?? new Date(0).toISOString(),
                title: `${property.label !== "" ? property.label : property.url} is ${property.status}`,
            })),
        ...runs
            .filter((run) => isRunFailure(run))
            .map((run) => {
                const property = propertyById.get(run.property_id);
                return {
                    actionLabel: "Open run",
                    detail: run.error_message?.trim() !== "" ? run.error_message ?? "Run failed." : "Recent ingestion run failed.",
                    id: `run-${run.id}`,
                    kind: "run" as const,
                    propertyId: run.property_id,
                    runId: run.id,
                    severity: "critical" as const,
                    sortAt: run.observed_at,
                    title: `Failed run for ${propertyLabel(property, run.property_id)}`,
                };
            }),
        ...notifications
            .filter((notification) => notification.read_at === undefined)
            .map((notification) => ({
                actionLabel: "Mark reviewed",
                detail: notification.body,
                id: `notification-${notification.id}`,
                kind: "notification" as const,
                propertyId: notification.property_id,
                severity: "medium" as const,
                sortAt: notification.created_at,
                title: notification.title,
            })),
        ...properties
            .filter((property) => property.source_id === undefined || !hasSuccessfulRun(property, runSummaryByPropertyId.get(property.id)))
            .map((property) => ({
                actionLabel: property.source_id === undefined ? "Add source" : "Open property",
                detail: property.source_id === undefined ? "No source template is linked yet." : "This property has not recorded a successful run yet.",
                id: `config-${property.id}`,
                kind: "configuration" as const,
                propertyId: property.id,
                severity: property.source_id === undefined ? "high" as const : "low" as const,
                sortAt: property.updated_at ?? property.created_at ?? new Date(0).toISOString(),
                title: property.source_id === undefined ? `${propertyLabel(property, property.id)} needs a source template` : `${propertyLabel(property, property.id)} has no successful run yet}`,
            })),
    ];

    return items.sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity) || compareDateDescending(left.sortAt, right.sortAt));
};

export const summarizeEventData = (payload: Record<string, unknown>): string => {
    const keys = ["message", "error", "property_id", "source_id", "run_id", "status", "count"];
    const picked = keys
        .map((key) => [key, payload[key]] as const)
        .filter((entry) => entry[1] !== undefined)
        .slice(0, 4);

    if (picked.length > 0) {
        return picked.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
    }

    const entries = Object.entries(payload).slice(0, 3);
    if (entries.length === 0) {
        return "No payload fields";
    }

    return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
};

export const eventSeverity = (type: string): OperatorSeverity => {
    const normalized = type.toLowerCase();
    if (normalized.includes("failed") || normalized.includes("error")) {
        return "critical";
    }

    if (normalized.includes("notification") || normalized.includes("retry")) {
        return "high";
    }

    if (normalized.includes("started") || normalized.includes("parse")) {
        return "medium";
    }

    return "low";
};

export const eventTone = (type: string): "danger" | "neutral" | "success" | "warning" => {
    const severity = eventSeverity(type);
    switch (severity) {
        case "critical":
            return "danger";
        case "high":
        case "medium":
            return "warning";
        case "low":
        default:
            return "neutral";
    }
};

export const readEntityId = (payload: Record<string, unknown>, key: "property_id" | "run_id" | "source_id"): string => {
    const value = payload[key];
    return typeof value === "string" ? value : "";
};

const hasSuccessfulRun = (property: Property, runSummary: PropertyRunSummary | undefined): boolean => {
    if (runSummary?.hasSuccessfulRun === true) {
        return true;
    }

    return property.last_run_at !== undefined;
};

const isHighPriorityTag = (tagName: string): boolean => {
    const normalized = tagName.trim().toLowerCase();
    return HIGH_PRIORITY_TAG_TOKENS.some((token) => normalized.includes(token));
};

const isRunFailure = (run: Run): boolean => {
    return !run.is_valid || (run.error_message?.trim() ?? "") !== "";
};

const isWithinHours = (value: string | undefined, hours: number, now: Date): boolean => {
    if (value === undefined) {
        return false;
    }

    const delta = now.getTime() - readDate(value);
    return delta >= 0 && delta <= hours * 60 * 60 * 1000;
};

const propertyLabel = (property: Property | undefined, fallback: string): string => {
    if (property === undefined) {
        return fallback;
    }

    return property.label !== "" ? property.label : property.url;
};

const readDate = (value: string | undefined): number => {
    if (value === undefined) {
        return 0;
    }

    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

const severityWeight = (severity: OperatorSeverity): number => {
    switch (severity) {
        case "critical":
            return 4;
        case "high":
            return 3;
        case "medium":
            return 2;
        case "low":
        default:
            return 1;
    }
};
