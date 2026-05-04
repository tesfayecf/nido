import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { DEFAULT_TAG_COLOR, resolveTagColor } from "@/components/tags/tagColors";
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
    const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR);
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
            setNewTagColor(DEFAULT_TAG_COLOR);
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
                <div className={"tag-picker__list"}>
                    {tags.length === 0 ? (
                        <p className={"muted-copy"} style={{ padding: "1rem", textAlign: "center" }}>
                            {"No tags yet. Create one below."}
                        </p>
                    ) : (
                        <div className={"tag-picker__items"}>
                            {tags.map((tag) => (
                                <label
                                    className={"tag-picker__item"}
                                    key={tag.id}
                                >
                                    <input
                                        checked={localSelection.has(tag.id)}
                                        onChange={() => { handleToggle(tag.id); }}
                                        type={"checkbox"}
                                    />
                                    <span
                                        aria-hidden
                                        className={"tag-swatch tag-swatch--medium"}
                                        style={{ "--tag-color": resolveTagColor(tag.color) } as CSSProperties}
                                    />
                                    <span>{tag.name}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className={"tag-picker__create"}>
                    <p className={"tag-picker__create-title"}>{"Add new tag"}</p>
                    <div className={"tag-picker__create-body"}>
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
