/**
 * File: app/src/features/engagement/BookmarksPage.tsx
 *
 * Purpose:
 * Implements the engagement feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, @tanstack/react-query, react-router-dom, @/components/ui/AsyncContent, @/components/ui/Button, @/components/ui/Field, @/components/ui/FormGrid, @/components/ui/Input; additional imports omitted for brevity
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @tanstack/react-query
 * - react-router-dom
 * - @/components/ui/AsyncContent
 * - @/components/ui/Button
 * - @/components/ui/Field
 * - @/components/ui/FormGrid
 * - @/components/ui/Input
 * - @/components/ui/ItemList
 * - @/components/ui/ListRow
 *
 * Key Decisions:
 * - Keeps documentation adjacent to the implementation so future changes update behavior and context together.
 * - Uses explicit imports and typed boundaries to make ownership traceable from this file in isolation.
 *
 * Constraints:
 * - Documentation must remain synchronized with behavior, tests, and related docs when this file changes.
 * - Runtime behavior must not depend on comments or documentation-only metadata.
 *
 * Related:
 * - /docs/frontend/documentation-template.md
 * - /app/docs/features/engagement.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
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
import { SecondarySurfaceHeader } from "@/components/ui/SecondarySurfaceHeader";
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

/**
 * Purpose: Renders the BookmarksPage UI boundary documented for app/src/features/engagement/BookmarksPage.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
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

    const groupCount = groupState.groups.length + 1;

    return (
        <PageStack>
            <SecondarySurfaceHeader
                description={"Bookmarks save properties directly, without any watchlist or listing intermediary."}
                summaryAriaLabel={"Bookmarks overview"}
                summaryItems={[
                    {
                        context: bookmarksQuery.isLoading ? "Loading saved properties." : bookmarks.length === 0 ? "No saved properties yet." : "Saved properties stay available for comparison and revisit.",
                        label: "Saved properties",
                        value: bookmarksQuery.isLoading ? "—" : `${bookmarks.length}`,
                    },
                    {
                        context: groupState.groups.length === 0 ? "Create groups to organize shortlist work." : "Groups are stored locally for quick organization.",
                        label: "Groups",
                        value: `${groupCount}`,
                    },
                    {
                        context: selectedIds.length === 0 ? "Select 2 to 4 properties to compare." : "Selected properties are ready for compare or removal.",
                        label: "Selected",
                        value: `${selectedIds.length}`,
                    },
                ]}
                title={"Bookmarks"}
            >
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
            </SecondarySurfaceHeader>
            <PageCard description={"Manage saved properties, group assignments, and compare actions from a single list."} title={"Saved properties"}>
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
