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
import { useToast } from "@/components/ui/ToastProvider";
import { formatDateTime } from "@/lib/format/date";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { deleteRun, getRun } from "@/services/backoffice-runs/runs.service";

export const RunDetailPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const { runId = "" } = useParams();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const runQuery = useQuery({
        enabled: runId !== "",
        queryFn: () => getRun(runId),
        queryKey: runKeys.detail(runId),
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

    const valueRows = useMemo(() => {
        return Object.entries(runQuery.data?.values ?? {}).map(([field, value]) => ({ field, value }));
    }, [runQuery.data?.values]);
    const changeRows = useMemo(() => {
        return Object.entries(runQuery.data?.change_flags ?? {}).map(([field, changed]) => ({
            changed: changed ? "Yes" : "No",
            field,
        }));
    }, [runQuery.data?.change_flags]);

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
                    description={"Runs are read-only snapshots. Use the table sections below to scan values and changes quickly."}
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

                <PageCard description={"Current extracted values are shown as a read-only field table."} title={"Extracted Values"}>
                    {valueRows.length === 0 ? <EmptyState message={"This run did not store any extracted values."} /> : (
                        <DataTable
                            caption={"Run extracted values"}
                            columns={[
                                { cell: (item) => item.field, header: "Field", id: "field", sortValue: (item) => item.field },
                                { cell: (item) => item.value, header: "Value", id: "value" },
                            ]}
                            compact
                            emptyMessage={"This run did not store any extracted values."}
                            getRowId={(item) => item.field}
                            items={valueRows}
                            pageSize={12}
                        />
                    )}
                </PageCard>

                <PageCard description={"Change flags indicate what changed compared with the previous valid run."} title={"Change Flags"}>
                    {changeRows.length === 0 ? <EmptyState message={"No field-level changes were recorded for this run."} /> : (
                        <DataTable
                            caption={"Run change flags"}
                            columns={[
                                { cell: (item) => item.field, header: "Field", id: "field", sortValue: (item) => item.field },
                                { cell: (item) => item.changed, header: "Changed", id: "changed", sortValue: (item) => item.changed },
                            ]}
                            compact
                            emptyMessage={"No field-level changes were recorded for this run."}
                            getRowId={(item) => item.field}
                            items={changeRows}
                            pageSize={12}
                        />
                    )}
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
