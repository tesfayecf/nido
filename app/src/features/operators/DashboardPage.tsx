import { useMemo, useState } from "react";

import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { AsyncContent } from "@/components/ui/AsyncContent";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format/date";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { listRuns } from "@/services/backoffice-runs/runs.service";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { listSources } from "@/services/backoffice-sources/sources.service";
import { notificationKeys } from "@/services/notifications/notifications.keys";
import { listNotifications } from "@/services/notifications/notifications.service";
import { buildDashboardSummary } from "@/features/operators/operatorWorkflows";
import { propertyKeys } from "@/services/properties/properties.keys";
import { listProperties } from "@/services/properties/properties.service";
import { tagKeys } from "@/services/tags/tags.keys";
import { listPropertyTags, listTags } from "@/services/tags/tags.service";

const RUN_FILTERS = { limit: 250, property_id: "" };
const NOTIFICATION_FILTERS = { limit: 100, unread_only: false };

export const DashboardPage = (): JSX.Element => {
    const [timeRangeDays, setTimeRangeDays] = useState("30");
    const [sourceFilter, setSourceFilter] = useState("");
    const [tagFilter, setTagFilter] = useState("");

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
    const tagsQuery = useQuery({
        queryFn: listTags,
        queryKey: tagKeys.list(),
    });
    const propertyTagQueries = useQueries({
        queries: (propertiesQuery.data ?? []).map((property) => ({
            queryFn: () => listPropertyTags(property.id),
            queryKey: tagKeys.propertyTags(property.id),
        })),
    });

    const summary = useMemo(() => {
        return buildDashboardSummary({
            notifications: notificationsQuery.data?.items ?? [],
            properties: propertiesQuery.data ?? [],
            runs: runsQuery.data?.items ?? [],
            sources: sourcesQuery.data ?? [],
        });
    }, [notificationsQuery.data?.items, propertiesQuery.data, runsQuery.data?.items, sourcesQuery.data]);

    const analytics = useMemo(() => {
        const now = Date.now();
        const cutoff = now - Number(timeRangeDays) * 24 * 60 * 60 * 1000;
        const propertyTagMap = new Map<string, string[]>();
        (propertiesQuery.data ?? []).forEach((property, index) => {
            propertyTagMap.set(property.id, (propertyTagQueries[index]?.data ?? []).map((tag) => tag.id));
        });

        const filteredProperties = (propertiesQuery.data ?? []).filter((property) => {
            const matchesSource = sourceFilter === "" || property.source_id === sourceFilter;
            const matchesTag = tagFilter === "" || (propertyTagMap.get(property.id) ?? []).includes(tagFilter);
            return matchesSource && matchesTag;
        });
        const filteredPropertyIds = new Set(filteredProperties.map((property) => property.id));
        const filteredRuns = (runsQuery.data?.items ?? []).filter((run) => filteredPropertyIds.has(run.property_id) && new Date(run.observed_at).getTime() >= cutoff);
        const filteredNotifications = (notificationsQuery.data?.items ?? []).filter((notification) => notification.property_id === undefined || filteredPropertyIds.has(notification.property_id));

        const priceHistory = new Map<string, number[]>();
        filteredRuns.forEach((run) => {
            const raw = run.values.price;
            if (raw === undefined) {
                return;
            }

            const price = Number(String(raw).replace(/[^0-9.-]/g, ""));
            if (!Number.isFinite(price)) {
                return;
            }

            const current = priceHistory.get(run.property_id) ?? [];
            current.push(price);
            priceHistory.set(run.property_id, current);
        });

        const topMovers = [...priceHistory.entries()]
            .map(([propertyId, prices]) => {
                const latest = prices[0] ?? 0;
                const oldest = prices[prices.length - 1] ?? latest;
                const delta = latest - oldest;
                return { delta, propertyId, volatility: Math.max(...prices) - Math.min(...prices) };
            })
            .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
            .slice(0, 5);

        const sourceReliability = (sourcesQuery.data ?? [])
            .map((source) => {
                const sourcePropertyIds = filteredProperties.filter((property) => property.source_id === source.id).map((property) => property.id);
                const sourceRuns = filteredRuns.filter((run) => sourcePropertyIds.includes(run.property_id));
                const failures = sourceRuns.filter((run) => !run.is_valid || (run.error_message ?? "") !== "").length;
                const reliability = sourceRuns.length === 0 ? 100 : ((sourceRuns.length - failures) / sourceRuns.length) * 100;
                return { name: source.name, reliability, runs: sourceRuns.length };
            })
            .filter((item) => item.runs > 0)
            .sort((left, right) => right.reliability - left.reliability)
            .slice(0, 5);

        const operationalRisk = filteredProperties
            .map((property) => {
                const propertyRuns = filteredRuns.filter((run) => run.property_id === property.id);
                const failedRuns = propertyRuns.filter((run) => !run.is_valid || (run.error_message ?? "") !== "").length;
                return {
                    failedRuns,
                    label: property.label !== "" ? property.label : property.url,
                    propertyId: property.id,
                    risk: failedRuns + (property.status === "degraded" ? 2 : 0) + (property.paused ? 1 : 0),
                };
            })
            .sort((left, right) => right.risk - left.risk)
            .slice(0, 5);

        return {
            alertVolume: filteredNotifications.length,
            failureRate: filteredRuns.length === 0
                ? 0
                : (filteredRuns.filter((run) => !run.is_valid || (run.error_message ?? "") !== "").length / filteredRuns.length) * 100,
            operationalRisk,
            sourceReliability,
            topMovers,
            volatility: [...topMovers].sort((left, right) => right.volatility - left.volatility).slice(0, 5),
        };
    }, [notificationsQuery.data?.items, propertiesQuery.data, propertyTagQueries, runsQuery.data?.items, sourceFilter, sourcesQuery.data, tagFilter, timeRangeDays]);

    const isLoading = propertiesQuery.isLoading || runsQuery.isLoading || notificationsQuery.isLoading || sourcesQuery.isLoading || tagsQuery.isLoading;
    const isError = propertiesQuery.isError || runsQuery.isError || notificationsQuery.isError || sourcesQuery.isError || tagsQuery.isError;

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
                            <MetricCard label={"Unread notifications"} value={`${summary.unreadNotifications}`} />
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

            <PageCard description={"Inspect historical behavior across the full portfolio with repeatable filters for time range, source, and tag slices."} title={"Portfolio Analytics"}>
                <div style={{ display: "grid", gap: "1rem" }}>
                    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))" }}>
                        <Field label={"Time range"}>
                            <Select onChange={(event) => { setTimeRangeDays(event.target.value); }} value={timeRangeDays}>
                                <option value={"7"}>{"Last 7 days"}</option>
                                <option value={"30"}>{"Last 30 days"}</option>
                                <option value={"90"}>{"Last 90 days"}</option>
                            </Select>
                        </Field>
                        <Field label={"Source"}>
                            <Select onChange={(event) => { setSourceFilter(event.target.value); }} value={sourceFilter}>
                                <option value={""}>{"All sources"}</option>
                                {(sourcesQuery.data ?? []).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                            </Select>
                        </Field>
                        <Field label={"Tag"}>
                            <Select onChange={(event) => { setTagFilter(event.target.value); }} value={tagFilter}>
                                <option value={""}>{"All tags"}</option>
                                {(tagsQuery.data ?? []).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                            </Select>
                        </Field>
                    </div>
                    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}>
                        <MetricCard label={"Failure rate"} value={`${analytics.failureRate.toFixed(1)}%`} />
                        <MetricCard label={"Alert volume"} value={`${analytics.alertVolume}`} />
                    </div>
                    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))" }}>
                        <PageCard description={"Sources ranked by successful run share in the selected time range."} title={"Source reliability"}>
                            <SimpleList
                                emptyMessage={"No source activity for this filter set."}
                                items={analytics.sourceReliability.map((item) => ({
                                    description: `${item.reliability.toFixed(1)}% reliable across ${item.runs} runs`,
                                    href: "/sources",
                                    label: item.name,
                                }))}
                            />
                        </PageCard>
                        <PageCard description={"Properties with the largest observed price moves in the selected window."} title={"Top movers"}>
                            <SimpleList
                                emptyMessage={"No price movement detected yet."}
                                items={analytics.topMovers.map((item) => ({
                                    description: `${item.delta >= 0 ? "+" : ""}${item.delta.toFixed(0)} change`,
                                    href: `/properties/${item.propertyId}`,
                                    label: propertiesQuery.data?.find((property) => property.id === item.propertyId)?.label || item.propertyId,
                                }))}
                            />
                        </PageCard>
                        <PageCard description={"Properties with the widest price range over the selected period."} title={"Most volatile"}>
                            <SimpleList
                                emptyMessage={"No volatility data is available yet."}
                                items={analytics.volatility.map((item) => ({
                                    description: `${item.volatility.toFixed(0)} range`,
                                    href: `/properties/${item.propertyId}`,
                                    label: propertiesQuery.data?.find((property) => property.id === item.propertyId)?.label || item.propertyId,
                                }))}
                            />
                        </PageCard>
                        <PageCard description={"Properties with the most operational risk based on failures, degraded state, and paused automation."} title={"Operational risk"}>
                            <SimpleList
                                emptyMessage={"Operational risk is low across the current slice."}
                                items={analytics.operationalRisk.map((item) => ({
                                    description: `${item.failedRuns} failed runs in range`,
                                    href: `/properties/${item.propertyId}`,
                                    label: item.label,
                                }))}
                            />
                        </PageCard>
                    </div>
                </div>
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
