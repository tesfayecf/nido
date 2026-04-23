import { useEffect, useMemo, useState } from "react";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { PageCard } from "@/components/ui/PageCard";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDateTime } from "@/lib/format/date";
import { readNumberParam, readStringParam, writeParam } from "@/lib/routing/searchParams";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { deleteRun, listRuns } from "@/services/backoffice-runs/runs.service";
import type { Run, RunFilters } from "@/services/backoffice-runs/runs.types";
import { propertyKeys } from "@/services/properties/properties.keys";
import { ingestProperty, listProperties } from "@/services/properties/properties.service";

export const RunsPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const filters: RunFilters = {
        limit: readNumberParam(searchParams, "limit", 25),
        property_id: readStringParam(searchParams, "property_id"),
    };
    const [draftPropertyId, setDraftPropertyId] = useState(filters.property_id);
    const [draftLimit, setDraftLimit] = useState(`${filters.limit}`);
    const [triggerOpen, setTriggerOpen] = useState(false);
    const [triggerPropertyId, setTriggerPropertyId] = useState(filters.property_id);
    const [deleteTarget, setDeleteTarget] = useState<Run | null>(null);
    const runsQuery = useQuery({
        placeholderData: keepPreviousData,
        queryFn: () => listRuns(filters),
        queryKey: runKeys.list(filters),
    });
    const propertiesQuery = useQuery({
        queryFn: () => listProperties(),
        queryKey: propertyKeys.list(),
    });
    const triggerMutation = useMutation({
        mutationFn: (propertyId: string) => ingestProperty(propertyId),
        onError() {
            pushToast("Could not trigger the run.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: runKeys.all() });
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            setTriggerOpen(false);
            pushToast("Run started.", "success");
        },
    });
    const deleteMutation = useMutation({
        mutationFn: deleteRun,
        onError() {
            pushToast("Could not delete the run.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: runKeys.all() });
            setDeleteTarget(null);
            pushToast("Run deleted.", "success");
        },
    });

    useEffect(() => {
        setDraftPropertyId(filters.property_id);
        setDraftLimit(`${filters.limit}`);
        setTriggerPropertyId(filters.property_id);
    }, [filters.limit, filters.property_id]);

    const propertyOptions = useMemo(() => propertiesQuery.data ?? [], [propertiesQuery.data]);

    return (
        <>
            <PageCard
                action={<Button onClick={() => { setTriggerOpen(true); }}>{"Create run"}</Button>}
                description={"Runs are stored as snapshots and managed directly from the table."}
                title={"Runs"}
            >
                <FormGrid
                    variant={"inline"}
                    onSubmit={(event) => {
                        event.preventDefault();
                        const nextParams = new URLSearchParams(searchParams);
                        writeParam(nextParams, "property_id", draftPropertyId);
                        writeParam(nextParams, "limit", draftLimit);
                        setSearchParams(nextParams);
                    }}
                >
                    <Field label={"Property id"}>
                        <Input onChange={(event) => { setDraftPropertyId(event.target.value); }} value={draftPropertyId} />
                    </Field>
                    <Field label={"Limit"}>
                        <Input min={1} onChange={(event) => { setDraftLimit(event.target.value); }} step={1} type={"number"} value={draftLimit} />
                    </Field>
                    <Field as={"div"} variant={"actions"}>
                        <Button type={"submit"}>{"Apply"}</Button>
                    </Field>
                </FormGrid>
            </PageCard>

            <PageCard description={"Select a row to inspect the full snapshot payload."} title={"Recent Runs"}>
                {runsQuery.isLoading ? <p className={"state-message state-message--loading"}>{"Loading runs..."}</p> : null}
                {runsQuery.isError ? <ErrorBanner>{"Could not load runs."}</ErrorBanner> : null}
                {!runsQuery.isLoading && !runsQuery.isError ? (
                    <DataTable
                        caption={"Recent runs"}
                        columns={[
                            {
                                cell: (item) => item.id,
                                header: "Run",
                                id: "id",
                                sortValue: (item) => item.id,
                            },
                            {
                                cell: (item) => item.property_id,
                                header: "Property",
                                id: "property_id",
                                sortValue: (item) => item.property_id,
                            },
                            {
                                cell: (item) => <StatusBadge tone={statusTone(item)} value={item.is_valid ? "valid" : "invalid"} />,
                                header: "Status",
                                id: "status",
                                sortValue: (item) => item.is_valid ? "valid" : "invalid",
                            },
                            {
                                cell: (item) => formatDateTime(item.observed_at),
                                header: "Observed",
                                id: "observed_at",
                                sortValue: (item) => item.observed_at,
                            },
                            {
                                align: "right",
                                cell: (item) => `${Object.keys(item.values).length}`,
                                header: "Fields",
                                id: "fields",
                                sortValue: (item) => Object.keys(item.values).length,
                            },
                            {
                                cell: (item) => item.error_message === undefined || item.error_message === "" ? "Completed" : item.error_message,
                                header: "Message",
                                id: "message",
                            },
                            {
                                cell: (item) => (
                                    <div className={"action-group"} onClick={(event) => { event.stopPropagation(); }}>
                                        <Button
                                            onClick={() => {
                                                void navigate(`/runs/${item.id}`);
                                            }}
                                            size={"small"}
                                            variant={"secondary"}
                                        >
                                            {"Open"}
                                        </Button>
                                        <Button onClick={() => { setDeleteTarget(item); }} size={"small"} variant={"secondary"}>{"Delete"}</Button>
                                    </div>
                                ),
                                header: "Actions",
                                id: "actions",
                            },
                        ]}
                        compact
                        emptyMessage={"No runs matched the current filters."}
                        getRowId={(item) => item.id}
                        items={runsQuery.data?.items ?? []}
                        onRowClick={(item) => { void navigate(`/runs/${item.id}`); }}
                        pageSize={12}
                        rowLabel={(item) => `Open run ${item.id}`}
                    />
                ) : null}
            </PageCard>

            <Dialog
                onOpenChange={setTriggerOpen}
                open={triggerOpen}
                title={"Create run"}
            >
                <FormGrid
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (triggerPropertyId.trim() !== "") {
                            triggerMutation.mutate(triggerPropertyId.trim());
                        }
                    }}
                >
                    <Field label={"Property"}>
                        <Select onChange={(event) => { setTriggerPropertyId(event.target.value); }} value={triggerPropertyId}>
                            <option value={""}>{"Select a property"}</option>
                            {propertyOptions.map((property) => (
                                <option key={property.id} value={property.id}>
                                    {property.label !== "" ? property.label : property.url}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <div className={"action-group"}>
                        <Button onClick={() => { setTriggerOpen(false); }} variant={"secondary"}>{"Cancel"}</Button>
                        <Button disabled={triggerPropertyId.trim() === ""} isLoading={triggerMutation.isPending} type={"submit"}>
                            {"Trigger run"}
                        </Button>
                    </div>
                </FormGrid>
            </Dialog>

            <ConfirmDialog
                confirmLabel={"Delete run"}
                description={deleteTarget === null ? "" : `Delete run ${deleteTarget.id}? This removes the stored snapshot permanently.`}
                isPending={deleteMutation.isPending}
                onConfirm={() => {
                    if (deleteTarget !== null) {
                        deleteMutation.mutate(deleteTarget.id);
                    }
                }}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteTarget(null);
                    }
                }}
                open={deleteTarget !== null}
                title={"Delete run"}
            />
        </>
    );
};

const statusTone = (run: Run): "danger" | "success" | "warning" => {
    if (!run.is_valid && run.error_message !== undefined && run.error_message !== "") {
        return "danger";
    }

    return run.is_valid ? "success" : "warning";
};
