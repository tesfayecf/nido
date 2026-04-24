import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/ToastProvider";
import { summarizeRunChanges, buildRunFieldChanges } from "@/features/backoffice/runChangeSummary";
import { formatDateTime } from "@/lib/format/date";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { deleteRun, getRun } from "@/services/backoffice-runs/runs.service";
import { propertyKeys } from "@/services/properties/properties.keys";
import { listPropertySnapshots } from "@/services/properties/properties.service";

export const RunDetailPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const { runId = "" } = useParams();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [showUnchangedFields, setShowUnchangedFields] = useState(false);
    const runQuery = useQuery({
        enabled: runId !== "",
        queryFn: () => getRun(runId),
        queryKey: runKeys.detail(runId),
    });
    const runHistoryQuery = useQuery({
        enabled: runQuery.data?.property_id !== undefined,
        queryFn: () => listPropertySnapshots(runQuery.data?.property_id ?? "", 20),
        queryKey: propertyKeys.snapshots(runQuery.data?.property_id ?? ""),
    });
    const deleteMutation = useMutation({
        mutationFn: deleteRun,
        onError() {
            pushToast("Could not delete run.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: runKeys.all() });
            pushToast("Run deleted.", "success");
            void navigate("/runs");
        },
    });

    if (runId === "") {
        return (
            <PageStack>
                <PageCard description={"The route was loaded without a run identifier."} title={"Run detail unavailable"}>
                    <ErrorBanner>{"A run id is required."}</ErrorBanner>
                </PageCard>
            </PageStack>
        );
    }

    if (runQuery.isLoading) {
        return (
            <PageStack>
                <PageCard description={"The run metadata and extracted values are loading."} title={"Run"}>
                    <p className={"muted-copy"}>{"Loading run..."}</p>
                </PageCard>
            </PageStack>
        );
    }

    if (runQuery.isError || runQuery.data === undefined) {
        return (
            <PageStack>
                <PageCard description={"The selected run could not be loaded."} title={"Run"}>
                    <ErrorBanner>{"Could not load run detail."}</ErrorBanner>
                </PageCard>
            </PageStack>
        );
    }

    const run = runQuery.data;
    const currentSnapshot = runHistoryQuery.data?.find((snapshot) => snapshot.id === run.id) ?? run;
    const currentIndex = runHistoryQuery.data?.findIndex((snapshot) => snapshot.id === run.id) ?? -1;
    const previousSnapshot = currentIndex >= 0 ? runHistoryQuery.data?.[currentIndex + 1] : runHistoryQuery.data?.find((snapshot) => snapshot.id !== run.id);
    const fieldChanges = buildRunFieldChanges(currentSnapshot, previousSnapshot);
    const changedFields = fieldChanges.filter((item) => item.previousValue !== item.currentValue);
    const visibleFieldChanges = showUnchangedFields ? fieldChanges : changedFields;
    const summaryLines = summarizeRunChanges(fieldChanges);

    return (
        <>
            <PageStack>
                <PageCard
                    action={(
                        <ActionGroup>
                            <Button as={Link} to={"/runs"} variant={"secondary"}>{"Back"}</Button>
                            <Button onClick={() => { setDeleteOpen(true); }} variant={"secondary"}>{"Delete"}</Button>
                        </ActionGroup>
                    )}
                    description={"Runs are read-only snapshots. The comparison view explains what changed, how large the delta was, and which config version produced the result."}
                    title={`Run ${run.id}`}
                >
                    <KeyValueGrid compact>
                        <KeyValuePair label={"Status"} value={<StatusBadge tone={run.is_valid ? "success" : "warning"} value={run.is_valid ? "valid" : "invalid"} />} />
                        <KeyValuePair label={"Property id"} value={run.property_id} />
                        <KeyValuePair label={"Observed at"} value={formatDateTime(run.observed_at)} />
                        <KeyValuePair label={"Config version"} value={run.config_version} />
                    </KeyValueGrid>
                    {run.error_message !== undefined && run.error_message !== "" ? <ErrorBanner>{run.error_message}</ErrorBanner> : null}
                </PageCard>

                <PageCard
                    description={"Changed fields appear first with plain-language interpretation, numeric deltas, and a side-by-side before/after view."}
                    title={"What Changed In This Run"}
                >
                    {summaryLines.length === 0 ? <EmptyState message={"This run did not introduce field-level changes compared with the previous snapshot."} /> : (
                        <div style={{ display: "grid", gap: "0.75rem" }}>
                            {summaryLines.map((line) => (
                                <article className={"selector-builder__result-card"} key={line}>
                                    <span className={"selector-builder__result-label"}>{"Change summary"}</span>
                                    <strong className={"selector-builder__result-value"}>{line}</strong>
                                </article>
                            ))}
                        </div>
                    )}
                </PageCard>

                <PageCard
                    action={<Toggle checked={showUnchangedFields} label={"Show unchanged fields"} onCheckedChange={setShowUnchangedFields} />}
                    description={"Use the table to compare previous and current values, absolute deltas, percentage movement, and significance."}
                    title={"Field Comparison"}
                >
                    {visibleFieldChanges.length === 0 ? <EmptyState message={"No field values are available for comparison."} /> : (
                        <DataTable
                            caption={"Run field comparison"}
                            columns={[
                                { cell: (item) => item.field, header: "Field", id: "field", sortValue: (item) => item.field },
                                { cell: (item) => item.previousValue, header: "Previous", id: "previous" },
                                { cell: (item) => item.currentValue, header: "Current", id: "current" },
                                {
                                    cell: (item) => item.absoluteDelta === undefined ? "—" : `${item.absoluteDelta > 0 ? "+" : ""}${item.absoluteDelta}`,
                                    header: "Absolute delta",
                                    id: "absolute",
                                },
                                {
                                    cell: (item) => item.percentageDelta === undefined ? "—" : `${item.percentageDelta > 0 ? "+" : ""}${item.percentageDelta.toFixed(1)}%`,
                                    header: "Percent",
                                    id: "percent",
                                },
                                {
                                    cell: (item) => <StatusBadge tone={item.significant ? "warning" : "neutral"} value={item.significant ? "attention" : "minor"} />,
                                    header: "Impact",
                                    id: "impact",
                                },
                            ]}
                            compact
                            emptyMessage={"This run did not store any extracted values."}
                            getRowId={(item) => item.field}
                            items={visibleFieldChanges}
                            pageSize={12}
                        />
                    )}
                </PageCard>

                <PageCard description={"The comparison is anchored to the immediately previous snapshot for this property."} title={"Comparison Context"}>
                    <KeyValueGrid compact>
                        <KeyValuePair label={"Changed fields"} value={`${changedFields.length}`} />
                        <KeyValuePair label={"Compared against"} value={previousSnapshot === undefined ? "No previous snapshot" : formatDateTime(previousSnapshot.observed_at)} />
                        <KeyValuePair label={"Previous config"} value={previousSnapshot?.config_version ?? "—"} />
                        <KeyValuePair label={"Current config"} value={currentSnapshot.config_version} />
                    </KeyValueGrid>
                </PageCard>
            </PageStack>

            <ConfirmDialog
                confirmLabel={"Delete run"}
                description={`Delete run ${run.id}? This removes the stored snapshot permanently.`}
                isPending={deleteMutation.isPending}
                onConfirm={() => {
                    deleteMutation.mutate(run.id);
                }}
                onOpenChange={setDeleteOpen}
                open={deleteOpen}
                title={"Delete run"}
            />
        </>
    );
};
