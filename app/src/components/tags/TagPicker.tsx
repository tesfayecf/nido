import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";
import { tagKeys } from "@/services/tags/tags.keys";
import { createTag, listTags } from "@/services/tags/tags.service";

interface TagPickerProps {
    readonly onChange: (tagIds: string[]) => void;
    readonly onOpenChange: (open: boolean) => void;
    readonly open: boolean;
    readonly selectedTagIds: string[];
}

/**
 * Multi-select tag picker with inline tag creation.
 *
 * @param props The picker configuration and callbacks.
 * @returns A tag selection dialog.
 */
export const TagPicker = ({ onChange, onOpenChange, open, selectedTagIds }: TagPickerProps): JSX.Element => {
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("#3b82f6");
    const [localSelection, setLocalSelection] = useState<Set<string>>(new Set(selectedTagIds));
    
    const tagsQuery = useQuery({
        queryFn: listTags,
        queryKey: tagKeys.list(),
    });
    
    const createTagMutation = useMutation({
        mutationFn: createTag,
        onError() {
            pushToast("Could not create tag.", "error");
        },
        onSuccess(data) {
            void queryClient.invalidateQueries({ queryKey: tagKeys.list() });
            setLocalSelection((prev) => new Set([...prev, data.id]));
            setNewTagName("");
            setNewTagColor("#3b82f6");
            pushToast("Tag created.", "success");
        },
    });
    
    const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data]);
    
    const handleToggle = (tagId: string): void => {
        setLocalSelection((prev) => {
            const next = new Set(prev);
            if (next.has(tagId)) {
                next.delete(tagId);
            } else {
                next.add(tagId);
            }

            return next;
        });
    };
    
    const handleSave = (): void => {
        onChange(Array.from(localSelection));
        onOpenChange(false);
    };
    
    const handleCreateTag = (): void => {
        if (newTagName.trim() === "") {
            return;
        }
        
        createTagMutation.mutate({
            color: newTagColor,
            name: newTagName.trim(),
        });
    };
    
    return (
        <Dialog
            actions={(
                <>
                    <Button onClick={() => { onOpenChange(false); }} variant={"secondary"}>
                        {"Cancel"}
                    </Button>
                    <Button onClick={handleSave}>
                        {"Save"}
                    </Button>
                </>
            )}
            onOpenChange={onOpenChange}
            open={open}
            title={"Edit tags"}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "0.5rem", maxHeight: "20rem", overflowY: "auto", padding: "0.5rem" }}>
                    {tags.length === 0 ? (
                        <p className={"muted-copy"} style={{ padding: "1rem", textAlign: "center" }}>
                            {"No tags yet. Create one below."}
                        </p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            {tags.map((tag) => (
                                <label
                                    key={tag.id}
                                    style={{
                                        alignItems: "center",
                                        cursor: "pointer",
                                        display: "flex",
                                        gap: "0.5rem",
                                        padding: "0.5rem",
                                    }}
                                >
                                    <input
                                        checked={localSelection.has(tag.id)}
                                        onChange={() => { handleToggle(tag.id); }}
                                        type={"checkbox"}
                                    />
                                    <span
                                        style={{
                                            backgroundColor: tag.color !== "" ? tag.color : "#6b7280",
                                            borderRadius: "50%",
                                            display: "inline-block",
                                            height: "0.75rem",
                                            width: "0.75rem",
                                        }}
                                    />
                                    <span>{tag.name}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
                
                <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
                    <p style={{ fontWeight: 500, marginBottom: "0.5rem" }}>{"Add new tag"}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
                        <Button
                            disabled={newTagName.trim() === "" || createTagMutation.isPending}
                            onClick={handleCreateTag}
                            variant={"secondary"}
                        >
                            {createTagMutation.isPending ? "Creating..." : "Create tag"}
                        </Button>
                    </div>
                </div>
            </div>
        </Dialog>
    );
};
