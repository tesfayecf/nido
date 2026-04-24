import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TagBadge } from "@/components/tags/TagBadge";
import { tagKeys } from "@/services/tags/tags.keys";
import { listTags } from "@/services/tags/tags.service";

interface TagFilterProps {
    readonly onChange: (tagIds: string[], tagMatch: "any" | "all") => void;
    readonly selectedTagIds: string[];
    readonly tagMatch: "any" | "all";
}

/**
 * Multi-select tag filter with chips display.
 *
 * @param props The filter state and callbacks.
 * @returns A tag filter component.
 */
export const TagFilter = ({ onChange, selectedTagIds, tagMatch }: TagFilterProps): JSX.Element => {
    const tagsQuery = useQuery({
        queryFn: listTags,
        queryKey: tagKeys.list(),
    });
    
    const allTags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data]);
    const selectedTags = useMemo(() => {
        return allTags.filter((tag) => selectedTagIds.includes(tag.id));
    }, [allTags, selectedTagIds]);
    
    const handleRemoveTag = (tagId: string): void => {
        const nextIds = selectedTagIds.filter((id) => id !== tagId);
        onChange(nextIds, tagMatch);
    };
    
    const handleClearAll = (): void => {
        onChange([], tagMatch);
    };
    
    const handleToggleTag = (tagId: string): void => {
        if (selectedTagIds.includes(tagId)) {
            handleRemoveTag(tagId);
        } else {
            onChange([...selectedTagIds, tagId], tagMatch);
        }
    };
    
    const handleToggleMatch = (): void => {
        onChange(selectedTagIds, tagMatch === "any" ? "all" : "any");
    };
    
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ alignItems: "center", display: "flex", gap: "0.5rem", justifyContent: "space-between" }}>
                <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                    <strong>{"Filter by tags:"}</strong>
                    {selectedTags.length > 0 ? 
                        <span className={"muted-copy"}>{`${selectedTags.length} selected`}</span>
                        : 
                        <span className={"muted-copy"}>{"All properties"}</span>
                    }
                </div>
                {selectedTags.length > 0 ? (
                    <Button onClick={handleClearAll} variant={"secondary"}>
                        {"Clear filters"}
                    </Button>
                ) : null}
            </div>
            
            {selectedTags.length > 0 ? (
                <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {selectedTags.map((tag) => (
                        <span
                            key={tag.id}
                            style={{
                                alignItems: "center",
                                display: "inline-flex",
                                gap: "0.25rem",
                            }}
                        >
                            <TagBadge tag={tag} />
                            <button
                                aria-label={`Remove ${tag.name} filter`}
                                className={"icon-button"}
                                onClick={() => { handleRemoveTag(tag.id); }}
                                style={{ padding: "0.125rem" }}
                                type={"button"}
                            >
                                <Icon name={"close"} />
                            </button>
                        </span>
                    ))}
                    {selectedTags.length > 1 ? (
                        <Button onClick={handleToggleMatch} variant={"secondary"}>
                            {tagMatch === "any" ? "Match any" : "Match all"}
                        </Button>
                    ) : null}
                </div>
            ) : null}
            
            <details style={{ border: "1px solid #e5e7eb", borderRadius: "0.5rem", padding: "0.5rem" }}>
                <summary style={{ cursor: "pointer", fontWeight: 500, padding: "0.25rem" }}>
                    {"Select tags"}
                </summary>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                    {allTags.map((tag) => (
                        <button
                            key={tag.id}
                            onClick={() => { handleToggleTag(tag.id); }}
                            style={{
                                backgroundColor: selectedTagIds.includes(tag.id) ? "#f3f4f6" : "transparent",
                                border: "1px solid #d1d5db",
                                borderRadius: "0.375rem",
                                cursor: "pointer",
                                padding: "0.25rem 0.5rem",
                            }}
                            type={"button"}
                        >
                            <TagBadge tag={tag} />
                        </button>
                    ))}
                    {allTags.length === 0 ? 
                        <p className={"muted-copy"}>{"No tags available. Create tags from the Tags page."}</p>
                        : null}
                </div>
            </details>
        </div>
    );
};
