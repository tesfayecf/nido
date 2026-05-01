import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { AsyncContent } from "@/components/ui/AsyncContent";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { ItemList } from "@/components/ui/ItemList";
import { ListRow, ListRowFooter, ListRowMain } from "@/components/ui/ListRow";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { Select } from "@/components/ui/Select";
import { formatCurrency } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/date";
import { stringifyComparisonIds } from "@/features/properties/propertyCompare";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { deleteBookmark, listBookmarks } from "@/services/bookmarks/bookmarks.service";

const BOOKMARK_GROUPS_KEY = "nido.bookmark-groups";

interface BookmarkGroupsState {
    readonly assignments: Record<string, string>;
    readonly groups: string[];
}

const readBookmarkGroups = (): BookmarkGroupsState => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(BOOKMARK_GROUPS_KEY) ?? "{}") as Partial<BookmarkGroupsState>;
        return {
            assignments: parsed.assignments ?? {},
            groups: parsed.groups ?? [],
        };
    } catch (error) {
        console.warn("Failed to parse bookmark groups.", error);
        return { assignments: {}, groups: [] };
    }
};

const saveBookmarkGroups = (state: BookmarkGroupsState): void => {
    window.localStorage.setItem(BOOKMARK_GROUPS_KEY, JSON.stringify(state));
};

export const BookmarksPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [groupState, setGroupState] = useState<BookmarkGroupsState>(readBookmarkGroups);
    const [newGroupName, setNewGroupName] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const bookmarksQuery = useQuery({
        queryFn: listBookmarks,
        queryKey: bookmarkKeys.all(),
    });
    const deleteMutation = useMutation({
        mutationFn: deleteBookmark,
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: bookmarkKeys.all() });
        },
    });
    const bookmarks = bookmarksQuery.data ?? [];
    const groupedBookmarks = useMemo(() => {
        const groups = new Map<string, typeof bookmarks>();
        for (const group of ["Ungrouped", ...groupState.groups]) {
            groups.set(group, []);
        }

        for (const bookmark of bookmarks) {
            const group = groupState.assignments[bookmark.property_id] ?? "Ungrouped";
            groups.set(group, [...groups.get(group) ?? [], bookmark]);
        }

        return Array.from(groups.entries()).filter(([, items]) => items.length > 0);
    }, [bookmarks, groupState]);

    const updateGroups = (nextState: BookmarkGroupsState): void => {
        setGroupState(nextState);
        saveBookmarkGroups(nextState);
    };

    return (
        <PageStack>
            <PageCard description={"Create folders and organize saved properties without changing the underlying bookmark record."} title={"Bookmark Groups"}>
                <FormGrid
                    onSubmit={(event) => {
                        event.preventDefault();
                        const trimmed = newGroupName.trim();
                        if (trimmed === "" || groupState.groups.includes(trimmed)) {
                            return;
                        }

                        updateGroups({ ...groupState, groups: [...groupState.groups, trimmed] });
                        setNewGroupName("");
                    }}
                    variant={"inline"}
                >
                    <Field label={"New group"}>
                        <Input onChange={(event) => { setNewGroupName(event.target.value); }} placeholder={"e.g., Shortlist"} value={newGroupName} />
                    </Field>
                    <Field as={"div"} variant={"actions"}>
                        <Button disabled={newGroupName.trim() === ""} type={"submit"}>{"Create group"}</Button>
                    </Field>
                </FormGrid>
            </PageCard>
            <PageCard description={"Bookmarks save properties directly, without any watchlist or listing intermediary."} title={"Bookmarks"}>
                {selectedIds.length > 0 ? (
                    <div className={"toolbar"}>
                        <strong>{`${selectedIds.length} selected`}</strong>
                        <Button
                            disabled={selectedIds.length < 2 || selectedIds.length > 4}
                            onClick={() => {
                                void navigate(`/properties/compare?ids=${encodeURIComponent(stringifyComparisonIds(selectedIds))}`);
                            }}
                            variant={"secondary"}
                        >
                            {"Compare"}
                        </Button>
                    </div>
                ) : null}
                <AsyncContent
                    emptyMessage={"No properties have been bookmarked yet."}
                    errorMessage={"Could not load bookmarks."}
                    isEmpty={bookmarksQuery.isSuccess && bookmarks.length === 0}
                    isError={bookmarksQuery.isError}
                    isLoading={bookmarksQuery.isLoading}
                    loadingMessage={"Loading bookmarks..."}
                >
                    <div className={"dashboard-grid"}>
                        {groupedBookmarks.map(([group, items]) => (
                            <section key={group}>
                                <h3>{group}</h3>
                                <ItemList>
                                    {items.map((item) => (
                                        <ListRow key={item.property_id}>
                                            <ListRowMain>
                                                <input
                                                    aria-label={`Select ${item.title}`}
                                                    checked={selectedIds.includes(item.property_id)}
                                                    onChange={(event) => {
                                                        setSelectedIds((current) => event.target.checked
                                                            ? [...current, item.property_id]
                                                            : current.filter((propertyId) => propertyId !== item.property_id));
                                                    }}
                                                    type={"checkbox"}
                                                />
                                                <div>
                                                    <h3 className={"list-row__title"}><Link to={`/properties/${item.property_id}`}>{item.title}</Link></h3>
                                                    <p className={"list-row__meta"}>{item.location}{" · saved "}{formatDateTime(item.bookmarked_at)}</p>
                                                </div>
                                                <strong className={"list-row__price"}>{item.currency === "" ? `${item.price_amount}` : formatCurrency(item.price_amount, item.currency)}</strong>
                                            </ListRowMain>
                                            <ListRowFooter>
                                                <Select
                                                    onChange={(event) => {
                                                        updateGroups({
                                                            ...groupState,
                                                            assignments: {
                                                                ...groupState.assignments,
                                                                [item.property_id]: event.target.value,
                                                            },
                                                        });
                                                    }}
                                                    size={"small"}
                                                    value={groupState.assignments[item.property_id] ?? "Ungrouped"}
                                                >
                                                    <option value={"Ungrouped"}>{"Ungrouped"}</option>
                                                    {groupState.groups.map((name) => <option key={name} value={name}>{name}</option>)}
                                                </Select>
                                                <a className={"text-link"} href={item.url} rel={"noreferrer"} target={"_blank"}>{"Open original"}</a>
                                                <Button disabled={deleteMutation.isPending} onClick={() => { deleteMutation.mutate(item.property_id); }} variant={"secondary"}>{"Remove"}</Button>
                                            </ListRowFooter>
                                        </ListRow>
                                    ))}
                                </ItemList>
                            </section>
                        ))}
                    </div>
                </AsyncContent>
            </PageCard>
        </PageStack>
    );
};
