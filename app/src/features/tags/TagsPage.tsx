import type { CSSProperties } from "react";
import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { QueryDataTable } from "@/components/ui/QueryDataTable";
import { SecondarySurfaceHeader } from "@/components/ui/SecondarySurfaceHeader";
import { DEFAULT_TAG_COLOR, resolveTagColor } from "@/components/tags/tagColors";
import { useToast } from "@/components/ui/ToastProvider";
import { tagKeys } from "@/services/tags/tags.keys";
import { createTag, deleteTag, listTags } from "@/services/tags/tags.service";
import type { Tag } from "@/services/tags/tags.types";

const formatMediumDate = (value: string): string => {
    return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
};

export const TagsPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [createOpen, setCreateOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR);

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
            setNewTagColor(DEFAULT_TAG_COLOR);
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

    const tags = tagsQuery.data ?? [];
    const colorCount = new Set(tags.map((tag) => tag.color !== "" ? tag.color : "__default__")).size;
    const recentTagCount = tags.filter((tag) => Date.now() - new Date(tag.created_at).getTime() <= 1000 * 60 * 60 * 24 * 30).length;

    return (
        <>
            <PageStack>
                <SecondarySurfaceHeader
                    action={(
                        <Button iconBefore={<Icon name={"plus"} />} onClick={() => { setCreateOpen(true); }}>
                            {"Create tag"}
                        </Button>
                    )}
                    description={"Manage tags for organizing and filtering properties."}
                    summaryAriaLabel={"Tags overview"}
                    summaryItems={[
                        {
                            context: tagsQuery.isLoading ? "Loading tags." : tags.length === 0 ? "No tags have been created yet." : "Tags can be applied across properties and filters.",
                            label: "Tags",
                            value: tagsQuery.isLoading ? "—" : `${tags.length}`,
                        },
                        {
                            context: tagsQuery.isLoading ? "Loading color coverage." : colorCount === 0 ? "No colors assigned yet." : "Distinct colors help scanning and filtering.",
                            label: "Colors",
                            value: tagsQuery.isLoading ? "—" : `${colorCount}`,
                        },
                        {
                            context: tagsQuery.isLoading ? "Loading recent tags." : "Created in the last 30 days.",
                            label: "Recent",
                            value: tagsQuery.isLoading ? "—" : `${recentTagCount}`,
                        },
                    ]}
                    title={"Tags"}
                />

                <PageCard description={"Review existing tags, their colors, and destructive actions from one list."} title={"Tag list"}>
                    <QueryDataTable
                        caption={"Available tags"}
                        className={"tags-table"}
                        columns={[
                            {
                                cell: (item) => (
                                    <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                                        <span
                                            aria-hidden
                                            className={"tag-swatch tag-swatch--medium"}
                                            style={{ "--tag-color": resolveTagColor(item.color) } as CSSProperties}
                                        />
                                        <strong>{item.name}</strong>
                                    </div>
                                ),
                                header: "Tag",
                                id: "name",
                                sortValue: (item) => item.name,
                                width: "40%",
                            },
                            {
                                cell: (item) => item.color !== "" ? item.color : "—",
                                header: "Color",
                                id: "color",
                                width: "20%",
                            },
                            {
                                cell: (item) => formatMediumDate(item.created_at),
                                header: "Created",
                                id: "created_at",
                                sortValue: (item) => item.created_at,
                                width: "24%",
                                wrap: true,
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
                                width: "16%",
                            },
                        ]}
                        emptyMessage={"No tags yet. Create your first tag to start organizing properties."}
                        errorMessage={"Could not load tags."}
                        getRowId={(item) => item.id}
                        isError={tagsQuery.isError}
                        isLoading={tagsQuery.isLoading}
                        items={tags}
                        loadingMessage={"Loading tags..."}
                        pageSize={20}
                        rowLabel={(item) => `Tag ${item.name}`}
                    />
                </PageCard>
            </PageStack>

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
                title={"Create tag"}
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
                            className={"tag-color-input"}
                            onChange={(event) => { setNewTagColor(event.target.value); }}
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
