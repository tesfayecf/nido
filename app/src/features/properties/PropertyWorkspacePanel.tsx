import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { PageCard } from "@/components/ui/PageCard";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDateTime } from "@/lib/format/date";
import { workspaceKeys } from "@/services/workspace/workspace.keys";
import { getPropertyMetadata, listPropertyAudit, updatePropertyMetadata } from "@/services/workspace/workspace.service";
import type { PropertyMetadata } from "@/services/workspace/workspace.types";

interface PropertyWorkspacePanelProps {
    readonly propertyId: string;
}

const DEFAULT_METADATA: PropertyMetadata = {
    priority: "medium",
    property_id: "",
    workflow_state: "unreviewed",
};

export const PropertyWorkspacePanel = ({ propertyId }: PropertyWorkspacePanelProps): JSX.Element => {
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const metadataQuery = useQuery({
        queryFn: () => getPropertyMetadata(propertyId),
        queryKey: workspaceKeys.metadata(propertyId),
    });
    const auditQuery = useQuery({
        queryFn: () => listPropertyAudit(propertyId),
        queryKey: workspaceKeys.audit(propertyId),
    });

    const [draft, setDraft] = useState<PropertyMetadata>(DEFAULT_METADATA);

    useEffect(() => {
        if (metadataQuery.data !== undefined) {
            setDraft(metadataQuery.data);
        }
    }, [metadataQuery.data]);

    const metadataMutation = useMutation({
        mutationFn: () => updatePropertyMetadata(propertyId, { ...draft, property_id: propertyId }),
        onSuccess(data) {
            queryClient.setQueryData(workspaceKeys.metadata(propertyId), data);
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.audit(propertyId) });
            pushToast("Property context saved.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not save property context.", "error");
        },
    });

    return (
        <>
            <PageCard
                action={(
                    <Button disabled={metadataMutation.isPending} onClick={() => { metadataMutation.mutate(); }}>
                        {metadataMutation.isPending ? "Saving..." : "Save context"}
                    </Button>
                )}
                description={"Track workflow, pricing targets, and notes without ownership, watchers, or threaded collaboration."}
                title={"Property Context"}
            >
                <KeyValueGrid compact>
                    <KeyValuePair label={"Workflow state"} value={draft.workflow_state} />
                    <KeyValuePair label={"Priority"} value={draft.priority} />
                    <KeyValuePair label={"Pipeline stage"} value={draft.pipeline_stage ?? "Not set"} />
                </KeyValueGrid>
                <FormGrid>
                    <Field label={"Workflow state"}>
                        <Select
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, workflow_state: event.target.value as PropertyMetadata["workflow_state"] }));
                            }}
                            value={draft.workflow_state}
                        >
                            <option value={"unreviewed"}>{"unreviewed"}</option>
                            <option value={"investigating"}>{"investigating"}</option>
                            <option value={"resolved"}>{"resolved"}</option>
                        </Select>
                    </Field>
                    <Field label={"Priority"}>
                        <Select
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, priority: event.target.value }));
                            }}
                            value={draft.priority}
                        >
                            <option value={"low"}>{"low"}</option>
                            <option value={"medium"}>{"medium"}</option>
                            <option value={"high"}>{"high"}</option>
                            <option value={"critical"}>{"critical"}</option>
                        </Select>
                    </Field>
                    <Field label={"Pipeline stage"}>
                        <Input
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, pipeline_stage: event.target.value }));
                            }}
                            value={draft.pipeline_stage ?? ""}
                        />
                    </Field>
                    <Field label={"Target price"}>
                        <Input
                            inputMode={"decimal"}
                            onChange={(event) => {
                                const value = event.target.value.trim();
                                setDraft((current) => ({ ...current, target_price: value === "" ? undefined : Number(value) }));
                            }}
                            value={draft.target_price?.toString() ?? ""}
                        />
                    </Field>
                    <Field label={"Expected yield / rent"}>
                        <Input
                            inputMode={"decimal"}
                            onChange={(event) => {
                                const value = event.target.value.trim();
                                setDraft((current) => ({ ...current, expected_yield: value === "" ? undefined : Number(value) }));
                            }}
                            value={draft.expected_yield?.toString() ?? ""}
                        />
                    </Field>
                    <Field label={"Acquisition notes"}>
                        <Textarea
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, acquisition_notes: event.target.value }));
                            }}
                            rows={3}
                            value={draft.acquisition_notes ?? ""}
                        />
                    </Field>
                    <Field label={"Deal thesis"}>
                        <Textarea
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, deal_thesis: event.target.value }));
                            }}
                            rows={3}
                            value={draft.deal_thesis ?? ""}
                        />
                    </Field>
                    <Field label={"External references"}>
                        <Textarea
                            onChange={(event) => {
                                const next = event.target.value
                                    .split("\n")
                                    .map((line) => line.trim())
                                    .filter((line) => line.includes(":"))
                                    .map((line) => {
                                        const [rawKey = "", ...value] = line.split(":");
                                        return { key: rawKey.trim(), value: value.join(":").trim() };
                                    });
                                setDraft((current) => ({ ...current, external_references: next }));
                            }}
                            rows={3}
                            value={(draft.external_references ?? []).map((entry) => `${entry.key}: ${entry.value}`).join("\n")}
                        />
                    </Field>
                    <Field label={"Attachments"}>
                        <Textarea
                            onChange={(event) => {
                                const next = event.target.value
                                    .split("\n")
                                    .map((line) => line.trim())
                                    .filter((line) => line.includes("|"))
                                    .map((line) => {
                                        const [rawLabel = "", ...urlParts] = line.split("|");
                                        return { label: rawLabel.trim(), url: urlParts.join("|").trim() };
                                    });
                                setDraft((current) => ({ ...current, attachments: next }));
                            }}
                            rows={3}
                            value={(draft.attachments ?? []).map((entry) => `${entry.label} | ${entry.url}`).join("\n")}
                        />
                    </Field>
                </FormGrid>
            </PageCard>

            <PageCard description={"Activity is attributed to the single workspace context."} title={"Activity Log"}>
                <DataTable
                    caption={"Recent property activity"}
                    columns={[
                        { cell: (item) => item.summary, header: "Summary", id: "summary" },
                        { cell: (item) => formatDateTime(item.created_at), header: "Created", id: "created_at", sortValue: (item) => item.created_at },
                    ]}
                    compact
                    emptyMessage={"No activity recorded yet."}
                    getRowId={(item) => item.id}
                    items={auditQuery.data ?? []}
                    pageSize={5}
                />
            </PageCard>
        </>
    );
};
