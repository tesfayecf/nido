import { useMemo } from "react";

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AsyncContent } from "@/components/ui/AsyncContent";
import { Button } from "@/components/ui/Button";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format/date";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { listRuns } from "@/services/backoffice-runs/runs.service";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { listSources } from "@/services/backoffice-sources/sources.service";
import { notificationKeys } from "@/services/notifications/notifications.keys";
import { listNotifications } from "@/services/notifications/notifications.service";
import { propertyKeys } from "@/services/properties/properties.keys";
import { listProperties } from "@/services/properties/properties.service";
import { buildDashboardSummary } from "@/features/operators/operatorWorkflows";

const RUN_FILTERS = { limit: 100, property_id: "" };
const NOTIFICATION_FILTERS = { limit: 100, unread_only: false };

export const DashboardPage = (): JSX.Element => {
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
    const sourcesQuery = useQuery({
        queryFn: listSources,
        queryKey: sourceKeys.list(),
    });

    const summary = useMemo(() => {
        return buildDashboardSummary({
            notifications: notificationsQuery.data?.items ?? [],
            properties: propertiesQuery.data ?? [],
            runs: runsQuery.data?.items ?? [],
            sources: sourcesQuery.data ?? [],
        });
    }, [notificationsQuery.data?.items, propertiesQuery.data, runsQuery.data?.items, sourcesQuery.data]);

    const isLoading = propertiesQuery.isLoading || runsQuery.isLoading || notificationsQuery.isLoading || sourcesQuery.isLoading;
    const isError = propertiesQuery.isError || runsQuery.isError || notificationsQuery.isError || sourcesQuery.isError;

    return (
        <PageStack>
            <PageCard
                action={(
                    <div className={"action-group"}>
                        <Button as={Link} to={"/triage"} variant={"secondary"}>{"Open triage inbox"}</Button>
                        <Button as={Link} to={"/properties?view=needs-review"}>{"Review priority queue"}</Button>
                    </div>
                )}
                description={"Start here each day to see what changed, what broke, and what needs action without scanning multiple pages."}
                title={"Dashboard"}
            >
                <AsyncContent
                    emptyMessage={"No portfolio activity is available yet."}
                    errorMessage={"Could not load dashboard data."}
                    isEmpty={!isLoading && !isError && summary.totalProperties === 0}
                    isError={isError}
                    isLoading={isLoading}
                    loadingMessage={"Loading dashboard..."}
                >
                    <div style={{ display: "grid", gap: "1rem" }}>
                        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))" }}>
                            <MetricCard label={"Tracked properties"} value={`${summary.totalProperties}`} />
                            <MetricCard label={"Failed runs (24h)"} value={`${summary.failedRunsLast24Hours}`} />
                            <MetricCard label={"Unread alerts"} value={`${summary.unreadNotifications}`} />
                            <MetricCard label={"Needs review"} value={`${summary.propertiesByStatus.degraded + summary.propertiesByStatus.inactive + summary.propertiesByStatus.pending}`} />
                        </div>

                        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))" }}>
                            <PageCard description={"Use these counts to scan overall portfolio health."} title={"Status breakdown"}>
                                <div style={{ display: "grid", gap: "0.75rem" }}>
                                    <StatusRow label={"Active"} tone={"success"} value={summary.propertiesByStatus.active} />
                                    <StatusRow label={"Degraded"} tone={"warning"} value={summary.propertiesByStatus.degraded} />
                                    <StatusRow label={"Inactive"} tone={"danger"} value={summary.propertiesByStatus.inactive} />
                                    <StatusRow label={"Pending"} tone={"neutral"} value={summary.propertiesByStatus.pending} />
                                </div>
                            </PageCard>

                            <PageCard description={"Most recent property records updated in the workspace."} title={"Changed recently"}>
                                <SimpleList
                                    emptyMessage={"No tracked properties have changed recently."}
                                    items={summary.changedRecently.map((property) => ({
                                        description: property.updated_at === undefined ? "No update timestamp" : `Updated ${formatDateTime(property.updated_at)}`,
                                        href: `/properties/${property.id}`,
                                        label: property.label !== "" ? property.label : property.url,
                                    }))}
                                />
                            </PageCard>

                            <PageCard description={"Upcoming automated checks already on the schedule."} title={"Next scheduled runs"}>
                                <SimpleList
                                    emptyMessage={"No automatic runs are scheduled yet."}
                                    items={summary.nextScheduledRuns.map((property) => ({
                                        description: property.next_run_at === undefined ? "Manual only" : `Runs ${formatDateTime(property.next_run_at)}`,
                                        href: `/properties/${property.id}`,
                                        label: property.label !== "" ? property.label : property.url,
                                    }))}
                                />
                            </PageCard>

                            <PageCard description={"Sources with the most degraded properties or failed runs."} title={"Top problematic sources"}>
                                <SimpleList
                                    emptyMessage={"No problematic sources detected right now."}
                                    items={summary.topProblemSources.map((source) => ({
                                        description: `${source.count} active issues`,
                                        href: `/sources/${source.sourceId}`,
                                        label: source.sourceName,
                                    }))}
                                />
                            </PageCard>
                        </div>
                    </div>
                </AsyncContent>
            </PageCard>
        </PageStack>
    );
};

interface MetricCardProps {
    readonly label: string;
    readonly value: string;
}

const MetricCard = ({ label, value }: MetricCardProps): JSX.Element => {
    return (
        <div style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "1rem" }}>
            <div className={"muted-copy"} style={{ marginTop: 0 }}>{label}</div>
            <strong style={{ display: "block", fontSize: "1.75rem", marginTop: "0.5rem" }}>{value}</strong>
        </div>
    );
};

interface SimpleListProps {
    readonly emptyMessage: string;
    readonly items: readonly {
        readonly description: string;
        readonly href: string;
        readonly label: string;
    }[];
}

const SimpleList = ({ emptyMessage, items }: SimpleListProps): JSX.Element => {
    if (items.length === 0) {
        return <p className={"muted-copy"} style={{ marginTop: 0 }}>{emptyMessage}</p>;
    }

    return (
        <div style={{ display: "grid", gap: "0.75rem" }}>
            {items.map((item) => (
                <Link key={`${item.href}-${item.label}`} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.875rem" }} to={item.href}>
                    <strong style={{ display: "block" }}>{item.label}</strong>
                    <span className={"muted-copy"} style={{ marginTop: "0.25rem" }}>{item.description}</span>
                </Link>
            ))}
        </div>
    );
};

interface StatusRowProps {
    readonly label: string;
    readonly tone: "danger" | "neutral" | "success" | "warning";
    readonly value: number;
}

const StatusRow = ({ label, tone, value }: StatusRowProps): JSX.Element => {
    return (
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <StatusBadge tone={tone} value={label} />
            <strong>{value}</strong>
        </div>
    );
};
