import { useMemo } from "react";

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

export const TriageInboxPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
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
    });
    const markReviewedMutation = useMutation({
        mutationFn: markNotificationRead,
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
            pushToast("Notification marked reviewed.", "success");
        },
    });

    const triageItems = useMemo(() => {
        const items = buildTriageItems({
            notifications: notificationsQuery.data?.items ?? [],
            properties: propertiesQuery.data ?? [],
            runSummaryByPropertyId: buildPropertyRunSummary(runsQuery.data?.items ?? []),
            runs: runsQuery.data?.items ?? [],
        });

        return severityFilter === "" ? items : items.filter((item) => item.severity === severityFilter);
    }, [notificationsQuery.data?.items, propertiesQuery.data, runsQuery.data?.items, severityFilter]);

    const isLoading = propertiesQuery.isLoading || runsQuery.isLoading || notificationsQuery.isLoading;
    const isError = propertiesQuery.isError || runsQuery.isError || notificationsQuery.isError;

    return (
        <PageStack>
            <PageCard
                description={"This inbox consolidates degraded properties, failed runs, unread alerts, and missing setup so you can move from overview to action quickly."}
                title={"Triage inbox"}
            >
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
                            {option.label}
                        </Button>
                    ))}
                </div>
            </PageCard>

            <PageCard description={"Rows are sorted by severity first, then recency."} title={`Work items (${triageItems.length})`}>
                <AsyncContent
                    emptyMessage={"No operational work items need attention right now."}
                    errorMessage={"Could not load triage data."}
                    isEmpty={!isLoading && !isError && triageItems.length === 0}
                    isError={isError}
                    isLoading={isLoading}
                    loadingMessage={"Loading triage inbox..."}
                >
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                        {triageItems.map((item) => {
                            const propertyId = item.propertyId;

                            return (
                                <article key={item.id} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", display: "grid", gap: "0.75rem", padding: "1rem" }}>
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
                                            <Button disabled={markReviewedMutation.isPending} onClick={() => { markReviewedMutation.mutate(item.id.replace("notification-", "")); }} variant={"secondary"}>
                                                {item.actionLabel}
                                            </Button>
                                        ) : null}
                                        {propertyId !== undefined && item.kind !== "notification"
                                            ? <Button disabled={runNowMutation.isPending} onClick={() => { runNowMutation.mutate(propertyId); }} variant={"secondary"}>{"Run now"}</Button>
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
