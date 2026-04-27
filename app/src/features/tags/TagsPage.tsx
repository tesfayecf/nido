import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { PageCard } from "@/components/ui/PageCard";
import { QueryDataTable } from "@/components/ui/QueryDataTable";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDateTime } from "@/lib/format/date";
import { tagKeys } from "@/services/tags/tags.keys";
import { createTag, deleteTag, listTags } from "@/services/tags/tags.service";
import type { Tag } from "@/services/tags/tags.types";

export const TagsPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [createOpen, setCreateOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("#3b82f6");

    const tagsQuery = useQuery({
        queryFn: listTags,
        queryKey: tagKeys.list(),
    });

    const createMutation = useMutation({
        mutationFn: createTag,
        onError() {
            pushToast("Could not create tag.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: tagKeys.list() });
            setCreateOpen(false);
            setNewTagName("");
            setNewTagColor("#3b82f6");
            pushToast("Tag created.", "success");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteTag,
        onError() {
            pushToast("Could not delete tag.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: tagKeys.list() });
            void queryClient.invalidateQueries({ queryKey: tagKeys.all() });
            setDeleteTarget(null);
            pushToast("Tag deleted.", "success");
        },
    });
    
    const handleCreate = (): void => {
        if (newTagName.trim() === "") {
            return;
        }

        createMutation.mutate({
            color: newTagColor,
            name: newTagName.trim(),
        });
    };

    return (
        <>
            <PageCard
                action={(
                    <Button iconBefore={<Icon name={"plus"} />} onClick={() => { setCreateOpen(true); }}>
                        {"New tag"}
                    </Button>
                )}
                description={"Manage tags for organizing and filtering properties."}
                title={"Tags"}
            />

            <QueryDataTable
                caption={"Available tags"}
                columns={[
                    {
                        cell: (item) => (
                            <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                                <span
                                    aria-hidden
                                    style={{
                                        backgroundColor: item.color !== "" ? item.color : "#6b7280",
                                        borderRadius: "50%",
                                        display: "inline-block",
                                        height: "1rem",
                                        width: "1rem",
                                    }}
                                />
                                <strong>{item.name}</strong>
                            </div>
                        ),
                        header: "Tag",
                        id: "name",
                        sortValue: (item) => item.name,
                    },
                    {
                        cell: (item) => item.color !== "" ? item.color : "—",
                        header: "Color",
                        id: "color",
                        width: "10rem",
                    },
                    {
                        cell: (item) => formatDateTime(item.created_at),
                        header: "Created",
                        id: "created_at",
                        sortValue: (item) => item.created_at,
                        width: "11rem",
                    },
                    {
                        align: "right",
                        cell: (item) => (
                            <button
                                aria-label={"Delete tag"}
                                className={"icon-button icon-button--danger"}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setDeleteTarget(item);
                                }}
                                title={"Delete"}
                                type={"button"}
                            >
                                <Icon name={"trash"} />
                            </button>
                        ),
                        header: "Actions",
                        id: "actions",
                        width: "6rem",
                    },
                ]}
                compact
                emptyMessage={"No tags yet. Create your first tag to start organizing properties."}
                errorMessage={"Could not load tags."}
                getRowId={(item) => item.id}
                isError={tagsQuery.isError}
                isLoading={tagsQuery.isLoading}
                items={tagsQuery.data ?? []}
                loadingMessage={"Loading tags..."}
                pageSize={20}
                rowLabel={(item) => `Tag: ${item.name}`}
            />

            <Dialog
                actions={(
                    <>
                        <Button onClick={() => { setCreateOpen(false); }} variant={"secondary"}>
                            {"Cancel"}
                        </Button>
                        <Button
                            disabled={newTagName.trim() === "" || createMutation.isPending}
                            onClick={handleCreate}
                        >
                            {createMutation.isPending ? "Creating..." : "Create tag"}
                        </Button>
                    </>
                )}
                onOpenChange={setCreateOpen}
                open={createOpen}
                title={"Create new tag"}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <Field label={"Tag name"}>
                        <Input
                            onChange={(event) => { setNewTagName(event.target.value); }}
                            placeholder={"e.g., High Priority"}
                            value={newTagName}
                        />
                    </Field>
                    <Field label={"Color"}>
                        <input
                            onChange={(event) => { setNewTagColor(event.target.value); }}
                            style={{ cursor: "pointer", height: "2.5rem", width: "100%" }}
                            type={"color"}
                            value={newTagColor}
                        />
                    </Field>
                </div>
            </Dialog>
            
            <ConfirmDialog
                confirmLabel={"Delete tag"}
                description={deleteTarget === null ? "" : `Delete "${deleteTarget.name}"? This will remove it from all properties.`}
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
                title={"Delete tag"}
            />
        </>
    );
};
