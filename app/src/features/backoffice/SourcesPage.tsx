import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { PageCard } from "@/components/ui/PageCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDateTime } from "@/lib/format/date";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { deleteSource, listSources, upsertSource } from "@/services/backoffice-sources/sources.service";
import type { Source } from "@/services/backoffice-sources/sources.types";

interface SourceDraft {
    readonly id: string;
    readonly name: string;
}

const defaultDraft = (): SourceDraft => ({
    id: "",
    name: "",
});

export const SourcesPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [createOpen, setCreateOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Source | null>(null);
    const [draft, setDraft] = useState<SourceDraft>(defaultDraft);
    const sourcesQuery = useQuery({
        queryFn: listSources,
        queryKey: sourceKeys.list(),
    });
    const createMutation = useMutation({
        mutationFn: () => upsertSource({
            config_json: "[]",
            id: draft.id.trim(),
            name: draft.name.trim(),
        }),
        onError() {
            pushToast("Could not create source.", "error");
        },
        onSuccess(source) {
            void queryClient.invalidateQueries({ queryKey: sourceKeys.list() });
            setCreateOpen(false);
            setDraft(defaultDraft());
            pushToast("Source created.", "success");
            void navigate(`/sources/${source.id}`);
        },
    });
    const deleteMutation = useMutation({
        mutationFn: deleteSource,
        onError() {
            pushToast("Could not delete source.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: sourceKeys.list() });
            setDeleteTarget(null);
            pushToast("Source deleted.", "success");
        },
    });

    const sources = sourcesQuery.data ?? [];
    const rows = useMemo(() => {
        return sources.map((source) => ({
            ...source,
            fieldCount: readFieldCount(source.config_json),
        }));
    }, [sources]);

    return (
        <>
            <PageCard
                action={<Button onClick={() => { setCreateOpen(true); }}>{"Create source"}</Button>}
                description={"Reusable source templates stay compact, searchable, and explicitly manageable from the table."}
                title={"Sources"}
            >
                <div className={"toolbar"}>
                    <span className={"muted-copy"}>{`${sources.length} templates`}</span>
                </div>
            </PageCard>

            <PageCard description={"Select a row to open the template detail view."} title={"Source Templates"}>
                {sourcesQuery.isLoading ? <p className={"state-message state-message--loading"}>{"Loading sources..."}</p> : null}
                {sourcesQuery.isError ? <ErrorBanner>{"Could not load sources."}</ErrorBanner> : null}
                {!sourcesQuery.isLoading && !sourcesQuery.isError ? (
                    <DataTable
                        caption={"Source templates"}
                        columns={[
                            {
                                cell: (item) => (
                                    <div>
                                        <strong>{item.name}</strong>
                                        <p className={"table-subcopy"}>{item.id}</p>
                                    </div>
                                ),
                                header: "Template",
                                id: "name",
                                sortValue: (item) => item.name,
                            },
                            {
                                cell: (item) => <StatusBadge tone={item.active === false ? "danger" : "success"} value={item.active === false ? "inactive" : "active"} />,
                                header: "Status",
                                id: "status",
                                sortValue: (item) => item.active === false ? "inactive" : "active",
                            },
                            {
                                align: "right",
                                cell: (item) => `${item.fieldCount}`,
                                header: "Fields",
                                id: "fields",
                                sortValue: (item) => item.fieldCount,
                            },
                            {
                                cell: (item) => item.updated_at === undefined ? "—" : formatDateTime(item.updated_at),
                                header: "Updated",
                                id: "updated",
                                sortValue: (item) => item.updated_at ?? "",
                            },
                            {
                                cell: (item) => item.created_at === undefined ? "—" : formatDateTime(item.created_at),
                                header: "Created",
                                id: "created",
                                sortValue: (item) => item.created_at ?? "",
                            },
                            {
                                cell: (item) => (
                                    <div className={"action-group"} onClick={(event) => { event.stopPropagation(); }}>
                                        <Button
                                            onClick={() => {
                                                void navigate(`/sources/${item.id}`);
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
                        emptyMessage={"No sources are configured yet."}
                        getRowId={(item) => item.id}
                        items={rows}
                        onRowClick={(item) => { void navigate(`/sources/${item.id}`); }}
                        pageSize={12}
                        rowLabel={(item) => `Open source ${item.name}`}
                    />
                ) : null}
            </PageCard>

            <Dialog
                onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (!open) {
                        setDraft(defaultDraft());
                    }
                }}
                open={createOpen}
                title={"Create source"}
            >
                <FormGrid
                    onSubmit={(event) => {
                        event.preventDefault();
                        createMutation.mutate();
                    }}
                >
                    <Field label={"Template id"}>
                        <Input
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, id: event.target.value }));
                            }}
                            value={draft.id}
                        />
                    </Field>
                    <Field label={"Template name"}>
                        <Input
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, name: event.target.value }));
                            }}
                            value={draft.name}
                        />
                    </Field>
                    <div className={"action-group"}>
                        <Button onClick={() => { setCreateOpen(false); }} variant={"secondary"}>{"Cancel"}</Button>
                        <Button disabled={draft.id.trim() === "" || draft.name.trim() === ""} isLoading={createMutation.isPending} type={"submit"}>
                            {"Create source"}
                        </Button>
                    </div>
                </FormGrid>
            </Dialog>

            <ConfirmDialog
                confirmLabel={"Delete source"}
                description={deleteTarget === null ? "" : `Delete ${deleteTarget.name}? This removes the source and any related ingestion artifacts.`}
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
                title={"Delete source"}
            />
        </>
    );
};

const readFieldCount = (configJson: string | undefined): number => {
    if (configJson === undefined || configJson.trim() === "") {
        return 0;
    }

    try {
        const parsed = JSON.parse(configJson) as unknown;
        return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
        return 0;
    }
};
