/**
 * File: app/src/features/operators/TriageInboxPage.tsx
 *
 * Purpose:
 * Implements the operators feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, @tanstack/react-query, react-router-dom, @/components/ui/AsyncContent, @/components/ui/Button, @/components/ui/PageCard, @/components/ui/PageStack, @/components/ui/StatusBadge; additional imports omitted for brevity
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @tanstack/react-query
 * - react-router-dom
 * - @/components/ui/AsyncContent
 * - @/components/ui/Button
 * - @/components/ui/PageCard
 * - @/components/ui/PageStack
 * - @/components/ui/StatusBadge
 * - @/components/ui/ToastProvider
 * - @/lib/format/date
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
 * - /app/docs/features/operators.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AsyncContent } from "@/components/ui/AsyncContent";
import { Button } from "@/components/ui/Button";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDateTime } from "@/lib/format/date";
import { writeParam } from "@/lib/routing/searchParams";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { listRuns } from "@/services/backoffice-runs/runs.service";
import { notificationKeys } from "@/services/notifications/notifications.keys";
import { listNotifications, markNotificationRead } from "@/services/notifications/notifications.service";
import { propertyKeys } from "@/services/properties/properties.keys";
import { ingestProperty, listProperties } from "@/services/properties/properties.service";
import { buildPropertyRunSummary, buildTriageItems, type OperatorSeverity } from "@/features/operators/operatorWorkflows";

const RUN_FILTERS = { limit: 100, property_id: "" };
const NOTIFICATION_FILTERS = { limit: 100, unread_only: false };
const SEVERITY_FILTERS: readonly { label: string; value: "" | OperatorSeverity; }[] = [
    { label: "All severities", value: "" },
    { label: "Critical", value: "critical" },
    { label: "High", value: "high" },
    { label: "Medium", value: "medium" },
    { label: "Low", value: "low" },
];

/**
 * Purpose: Renders the TriageInboxPage UI boundary documented for app/src/features/operators/TriageInboxPage.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const TriageInboxPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null);
    const [pendingPropertyId, setPendingPropertyId] = useState<string | null>(null);
    const severityFilter = (searchParams.get("severity") ?? "") as "" | OperatorSeverity;

    const propertiesQuery = useQuery({
        queryFn: () => listProperties(),
        queryKey: propertyKeys.list(),
    });
    const runsQuery = useQuery({
        queryFn: () => listRuns(RUN_FILTERS),
        queryKey: runKeys.list(RUN_FILTERS),
    });
    const notificationsQuery = useQuery({
        queryFn: () => listNotifications(NOTIFICATION_FILTERS),
        queryKey: notificationKeys.list(NOTIFICATION_FILTERS),
    });

    const runNowMutation = useMutation({
        mutationFn: (propertyId: string) => ingestProperty(propertyId),
        onError() {
            pushToast("Could not trigger the run.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: runKeys.all() });
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            pushToast("Run started.", "success");
        },
        onSettled() {
            setPendingPropertyId(null);
        },
    });
    const markReviewedMutation = useMutation({
        mutationFn: markNotificationRead,
        onError() {
            pushToast("Could not mark the notification reviewed.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
            pushToast("Notification marked reviewed.", "success");
        },
        onSettled() {
            setPendingNotificationId(null);
        },
    });

    const allTriageItems = useMemo(() => {
        const items = buildTriageItems({
            notifications: notificationsQuery.data?.items ?? [],
            properties: propertiesQuery.data ?? [],
            runSummaryByPropertyId: buildPropertyRunSummary(runsQuery.data?.items ?? []),
            runs: runsQuery.data?.items ?? [],
        });

        return items;
    }, [notificationsQuery.data?.items, propertiesQuery.data, runsQuery.data?.items]);
    const triageItems = useMemo(() => {
        return severityFilter === "" ? allTriageItems : allTriageItems.filter((item) => item.severity === severityFilter);
    }, [allTriageItems, severityFilter]);
    const severityCounts = useMemo(() => {
        return {
            critical: allTriageItems.filter((item) => item.severity === "critical").length,
            high: allTriageItems.filter((item) => item.severity === "high").length,
            low: allTriageItems.filter((item) => item.severity === "low").length,
            medium: allTriageItems.filter((item) => item.severity === "medium").length,
        } satisfies Record<OperatorSeverity, number>;
    }, [allTriageItems]);

    const isLoading = propertiesQuery.isLoading || runsQuery.isLoading || notificationsQuery.isLoading;
    const isError = propertiesQuery.isError || runsQuery.isError || notificationsQuery.isError;

    return (
        <PageStack>
            <PageCard
                description={"This inbox consolidates degraded properties, failed runs, unread notifications, and missing setup so operators can move from overview to action quickly."}
                title={"Triage inbox"}
            >
                <section aria-label={"Queue summary"} className={"dashboard-state-grid"} style={{ marginBottom: "1rem" }}>
                    <TriageSummaryTile context={severityFilter === "" ? "All severities are visible." : `Filtered to ${severityFilter} items.`} label={"Open items"} value={`${allTriageItems.length}`} />
                    <TriageSummaryTile context={severityCounts.critical === 0 ? "No critical failures are waiting." : "Critical failures should be handled first."} label={"Critical now"} value={`${severityCounts.critical}`} />
                    <TriageSummaryTile context={severityCounts.high === 0 ? "No high-severity follow-up is waiting." : "High-severity items still need review."} label={"High next"} value={`${severityCounts.high}`} />
                </section>
                <div className={"toolbar"}>
                    {SEVERITY_FILTERS.map((option) => (
                        <Button
                            key={option.label}
                            onClick={() => {
                                const nextParams = new URLSearchParams(searchParams);
                                writeParam(nextParams, "severity", option.value);
                                setSearchParams(nextParams);
                            }}
                            variant={severityFilter === option.value ? "primary" : "secondary"}
                        >
                            {`${option.label} (${option.value === "" ? allTriageItems.length : severityCounts[option.value]})`}
                        </Button>
                    ))}
                </div>
            </PageCard>

            <PageCard description={"Rows are sorted by severity first, then recency."} title={severityFilter === "" ? `Work items (${triageItems.length})` : `Work items (${triageItems.length} of ${allTriageItems.length})`}>
                <AsyncContent
                    emptyMessage={"No operational work items need attention right now."}
                    errorMessage={"Could not load triage data."}
                    isEmpty={!isLoading && !isError && triageItems.length === 0}
                    isError={isError}
                    isLoading={isLoading}
                    loadingMessage={"Loading triage inbox..."}
                >
                    <div role={"list"} style={{ display: "grid", gap: "0.75rem" }}>
                        {triageItems.map((item) => {
                            const propertyId = item.propertyId;
                            const notificationId = item.kind === "notification" ? item.id.replace("notification-", "") : null;
                            const isReviewPending = notificationId !== null && pendingNotificationId === notificationId && markReviewedMutation.isPending;
                            const isRunPending = propertyId !== undefined && pendingPropertyId === propertyId && runNowMutation.isPending;

                            return (
                                <article key={item.id} role={"listitem"} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", display: "grid", gap: "0.75rem", padding: "1rem" }}>
                                    <div style={{ alignItems: "flex-start", display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
                                        <div>
                                            <strong style={{ display: "block" }}>{item.title}</strong>
                                            <p className={"muted-copy"} style={{ marginTop: "0.35rem" }}>{item.detail}</p>
                                        </div>
                                        <StatusBadge tone={severityTone(item.severity)} value={item.severity} />
                                    </div>
                                    <div className={"toolbar"} style={{ marginTop: 0 }}>
                                        <span className={"muted-copy"}>{formatDateTime(item.sortAt)}</span>
                                        {propertyId !== undefined ? <Link className={"text-link"} to={`/properties/${propertyId}`}>{"Open property"}</Link> : null}
                                        {item.runId !== undefined ? <Link className={"text-link"} to={`/runs/${item.runId}`}>{"Open run"}</Link> : null}
                                        {item.kind === "notification" ? (
                                            <Button
                                                isLoading={isReviewPending}
                                                loadingLabel={"Marking reviewed"}
                                                onClick={() => {
                                                    if (notificationId === null) {
                                                        return;
                                                    }

                                                    setPendingNotificationId(notificationId);
                                                    markReviewedMutation.mutate(notificationId);
                                                }}
                                                variant={"secondary"}
                                            >
                                                {item.actionLabel}
                                            </Button>
                                        ) : null}
                                        {propertyId !== undefined && item.kind !== "notification"
                                            ? (
                                                <Button
                                                    isLoading={isRunPending}
                                                    loadingLabel={"Starting run"}
                                                    onClick={() => {
                                                        setPendingPropertyId(propertyId);
                                                        runNowMutation.mutate(propertyId);
                                                    }}
                                                    variant={"secondary"}
                                                >
                                                    {"Run now"}
                                                </Button>
                                            )
                                            : null}
                                        {item.kind === "configuration" && propertyId !== undefined
                                            ? <Button onClick={() => { void navigate(`/properties/${propertyId}`); }}>{item.actionLabel}</Button>
                                            : null}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </AsyncContent>
            </PageCard>
        </PageStack>
    );
};

const severityTone = (severity: OperatorSeverity): "danger" | "neutral" | "success" | "warning" => {
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

const TriageSummaryTile = ({
    context,
    label,
    value,
}: {
    readonly context: string;
    readonly label: string;
    readonly value: string;
}): JSX.Element => (
    <article className={"dashboard-state-tile"}>
        <span className={"dashboard-state-tile__label"}>{label}</span>
        <strong className={"dashboard-state-tile__value"}>{value}</strong>
        <p className={"dashboard-state-tile__context"}>{context}</p>
    </article>
);
