import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { PageCard } from "@/components/ui/PageCard";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDateTime } from "@/lib/format/date";
import { authKeys } from "@/services/auth/auth.keys";
import { getCurrentUser, listWorkspaceUsers } from "@/services/auth/auth.service";
import { workspaceKeys } from "@/services/workspace/workspace.keys";
import {
    createPropertyComment,
    getPropertyMetadata,
    listPropertyAudit,
    listPropertyComments,
    listPropertyWatchers,
    subscribeProperty,
    unsubscribeProperty,
    updatePropertyMetadata,
} from "@/services/workspace/workspace.service";
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
    const currentUserQuery = useQuery({
        queryFn: getCurrentUser,
        queryKey: authKeys.me(),
    });
    const usersQuery = useQuery({
        queryFn: listWorkspaceUsers,
        queryKey: authKeys.users(),
    });
    const metadataQuery = useQuery({
        queryFn: () => getPropertyMetadata(propertyId),
        queryKey: workspaceKeys.metadata(propertyId),
    });
    const watchersQuery = useQuery({
        queryFn: () => listPropertyWatchers(propertyId),
        queryKey: workspaceKeys.watchers(propertyId),
    });
    const commentsQuery = useQuery({
        queryFn: () => listPropertyComments(propertyId),
        queryKey: workspaceKeys.comments(propertyId),
    });
    const auditQuery = useQuery({
        queryFn: () => listPropertyAudit(propertyId),
        queryKey: workspaceKeys.audit(propertyId),
    });

    const [draft, setDraft] = useState<PropertyMetadata>(DEFAULT_METADATA);
    const [commentDraft, setCommentDraft] = useState("");

    useEffect(() => {
        if (metadataQuery.data !== undefined) {
            setDraft(metadataQuery.data);
        }
    }, [metadataQuery.data]);

    const watcherIds = useMemo(() => new Set((watchersQuery.data ?? []).map((watcher) => watcher.user_id)), [watchersQuery.data]);
    const isWatching = currentUserQuery.data !== undefined && watcherIds.has(currentUserQuery.data.id);

    const metadataMutation = useMutation({
        mutationFn: () => updatePropertyMetadata(propertyId, { ...draft, property_id: propertyId }),
        onSuccess(data) {
            queryClient.setQueryData(workspaceKeys.metadata(propertyId), data);
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.audit(propertyId) });
            pushToast("Property metadata saved.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not save property metadata.", "error");
        },
    });

    const commentMutation = useMutation({
        mutationFn: () => createPropertyComment(propertyId, commentDraft),
        onSuccess() {
            setCommentDraft("");
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.comments(propertyId) });
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.audit(propertyId) });
            pushToast("Comment added.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not add comment.", "error");
        },
    });

    const watcherMutation = useMutation({
        mutationFn: async () => {
            if (isWatching) {
                await unsubscribeProperty(propertyId);
                return;
            }

            await subscribeProperty(propertyId);
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.watchers(propertyId) });
            pushToast(isWatching ? "Watcher removed." : "Watcher added.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not update watcher subscription.", "error");
        },
    });

    const ownerLabel = usersQuery.data?.find((user) => user.id === draft.owner_id)?.display_name ?? "Unassigned";
    const watcherNames = (watchersQuery.data ?? []).map((watcher) => {
        return usersQuery.data?.find((user) => user.id === watcher.user_id)?.display_name ?? watcher.user_id;
    });

    return (
        <>
            <PageCard
                action={(
                    <ActionGroup>
                        <Button disabled={watcherMutation.isPending} onClick={() => { watcherMutation.mutate(); }} variant={"secondary"}>
                            {isWatching ? "Unwatch" : "Watch"}
                        </Button>
                        <Button disabled={metadataMutation.isPending} onClick={() => { metadataMutation.mutate(); }}>
                            {metadataMutation.isPending ? "Saving..." : "Save metadata"}
                        </Button>
                    </ActionGroup>
                )}
                description={"Track ownership, workflow state, and business context without changing extraction configuration."}
                title={"Workspace Collaboration"}
            >
                <KeyValueGrid compact>
                    <KeyValuePair label={"Primary owner"} value={ownerLabel} />
                    <KeyValuePair label={"Watchers"} value={watcherNames.length > 0 ? watcherNames.join(", ") : "No watchers"} />
                    <KeyValuePair label={"Workflow state"} value={draft.workflow_state} />
                    <KeyValuePair label={"Priority"} value={draft.priority} />
                </KeyValueGrid>
                <FormGrid>
                    <Field label={"Primary owner"}>
                        <Select
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, owner_id: event.target.value === "" ? undefined : event.target.value }));
                            }}
                            value={draft.owner_id ?? ""}
                        >
                            <option value={""}>{"Unassigned"}</option>
                            {(usersQuery.data ?? []).map((user) => <option key={user.id} value={user.id}>{`${user.display_name} · ${user.role}`}</option>)}
                        </Select>
                    </Field>
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
                                        const [rawLabel = "", rawUrl = ""] = line.split("|");
                                        return { label: rawLabel.trim(), url: rawUrl.trim() };
                                    });
                                setDraft((current) => ({ ...current, attachments: next }));
                            }}
                            rows={3}
                            value={(draft.attachments ?? []).map((entry) => `${entry.label} | ${entry.url}`).join("\n")}
                        />
                    </Field>
                </FormGrid>
            </PageCard>

            <PageCard description={"Plain-text collaboration notes support email-style mentions such as @operator@local."} title={"Comments and Mentions"}>
                <Field label={"New comment"}>
                    <Textarea onChange={(event) => { setCommentDraft(event.target.value); }} rows={4} value={commentDraft} />
                </Field>
                <ActionGroup>
                    <Button disabled={commentMutation.isPending || commentDraft.trim() === ""} onClick={() => { commentMutation.mutate(); }}>
                        {commentMutation.isPending ? "Posting..." : "Post comment"}
                    </Button>
                </ActionGroup>
                <DataTable
                    caption={"Property comments"}
                    columns={[
                        { cell: (item) => usersQuery.data?.find((user) => user.id === item.user_id)?.display_name ?? item.user_id, header: "Author", id: "author" },
                        { cell: (item) => item.body, header: "Comment", id: "body" },
                        { cell: (item) => item.mentions?.map((mention) => usersQuery.data?.find((user) => user.id === mention)?.display_name ?? mention).join(", ") ?? "—", header: "Mentions", id: "mentions" },
                        { cell: (item) => formatDateTime(item.created_at), header: "Created", id: "created_at", sortValue: (item) => item.created_at },
                    ]}
                    compact
                    emptyMessage={"No comments added yet."}
                    getRowId={(item) => item.id}
                    items={commentsQuery.data ?? []}
                    pageSize={5}
                />
            </PageCard>

            <PageCard description={"Every configuration, ownership, and workflow change stays traceable."} title={"Audit Trail"}>
                {auditQuery.data === undefined || auditQuery.data.length === 0 ? <EmptyState message={"No audit entries recorded yet."} /> : (
                    <DataTable
                        caption={"Audit trail"}
                        columns={[
                            { cell: (item) => formatDateTime(item.created_at), header: "When", id: "created_at", sortValue: (item) => item.created_at },
                            { cell: (item) => usersQuery.data?.find((user) => user.id === item.actor_user_id)?.display_name ?? item.actor_user_id ?? "System", header: "Actor", id: "actor" },
                            { cell: (item) => item.summary, header: "Summary", id: "summary" },
                        ]}
                        compact
                        emptyMessage={"No audit entries recorded yet."}
                        getRowId={(item) => item.id}
                        items={auditQuery.data}
                        pageSize={6}
                    />
                )}
            </PageCard>
        </>
    );
};
