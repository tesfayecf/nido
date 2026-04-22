import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { LiveEventsPanel } from "@/features/backoffice/LiveEventsPanel";
import { AsyncContent } from "@/components/ui/AsyncContent";
import { PageCard } from "@/components/ui/PageCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format/date";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { listSources } from "@/services/backoffice-sources/sources.service";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { createBookmark, deleteBookmark, listBookmarks } from "@/services/bookmarks/bookmarks.service";
import { propertyKeys } from "@/services/properties/properties.keys";
import { ingestProperty, listProperties } from "@/services/properties/properties.service";
import type { PropertyStatus } from "@/services/properties/properties.types";

const statusTone = (status: PropertyStatus): "danger" | "neutral" | "success" | "warning" => {
    switch (status) {
        case "active":
            return "success";
        case "degraded":
            return "warning";
        case "inactive":
            return "neutral";
        case "pending":
        default:
            return "neutral";
    }
};

export const PropertiesPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
    const propertiesQuery = useQuery({
        queryFn: listProperties,
        queryKey: propertyKeys.list(),
    });
    const sourcesQuery = useQuery({
        queryFn: listSources,
        queryKey: sourceKeys.list(),
    });
    const bookmarksQuery = useQuery({
        queryFn: listBookmarks,
        queryKey: bookmarkKeys.all(),
    });
    const ingestMutation = useMutation({
        mutationFn: ({ propertyId }: { propertyId: string; }) => ingestProperty(propertyId),
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            void queryClient.invalidateQueries({ queryKey: runKeys.all() });
        },
    });
    const bookmarkMutation = useMutation({
        mutationFn: async ({ isBookmarked, propertyId }: { isBookmarked: boolean; propertyId: string; }) => {
            if (isBookmarked) {
                await deleteBookmark(propertyId);
                return;
            }

            await createBookmark(propertyId);
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: bookmarkKeys.all() });
        },
    });

    const sourceNames = useMemo(() => {
        return new Map((sourcesQuery.data ?? []).map((source) => [source.id, source.name]));
    }, [sourcesQuery.data]);
    const bookmarkedIds = useMemo(() => new Set((bookmarksQuery.data ?? []).map((item) => item.property_id)), [bookmarksQuery.data]);
    const properties = (propertiesQuery.data ?? []).filter((item) => !bookmarkedOnly || bookmarkedIds.has(item.id));

    return (
        <div className={"split-layout"}>
            <div className={"page-stack"}>
                <PageCard
                    action={<Link className={"button"} to={"/properties/new"}>{"Add property"}</Link>}
                    description={"Track exact property URLs, assign reusable source templates, trigger fresh runs, and focus on bookmarked properties when needed."}
                    title={"Properties"}
                >
                    <label className={"field field--checkbox"}>
                        <input
                            checked={bookmarkedOnly}
                            onChange={(event) => {
                                setBookmarkedOnly(event.target.checked);
                            }}
                            type={"checkbox"}
                        />
                        <span className={"field__label"}>{"Show bookmarked properties only"}</span>
                    </label>
                </PageCard>

                <PageCard description={"Each property is tracked individually and keeps its own run history."} title={"Tracked Properties"}>
                    <AsyncContent
                        emptyMessage={bookmarkedOnly ? "No bookmarked properties matched the current filter." : "No properties are being tracked yet."}
                        errorMessage={"Could not load properties."}
                        isEmpty={propertiesQuery.isSuccess && properties.length === 0}
                        isError={propertiesQuery.isError}
                        isLoading={propertiesQuery.isLoading}
                        loadingMessage={"Loading properties..."}
                    >
                        <div className={"item-list"}>
                            {properties.map((item) => {
                                const isBookmarked = bookmarkedIds.has(item.id);
                                return (
                                    <article className={"list-row"} key={item.id}>
                                        <div className={"list-row__main"}>
                                            <div>
                                                <h3 className={"list-row__title"}>
                                                    <Link to={`/properties/${item.id}`}>{item.label !== "" ? item.label : item.url}</Link>
                                                </h3>
                                                <p className={"list-row__meta"}>
                                                    {sourceNames.get(item.source_id ?? "") ?? "No source template"}
                                                    {" · "}
                                                    {item.url}
                                                </p>
                                            </div>
                                            <div>
                                                <StatusBadge tone={statusTone(item.status)} value={item.status} />
                                                <strong className={"list-row__price"}>
                                                    {item.last_run_at === undefined ? "No runs yet" : `Last ${formatDateTime(item.last_run_at)}`}
                                                </strong>
                                            </div>
                                        </div>
                                        <div className={"list-row__footer"}>
                                            <span>
                                                {item.next_run_at === undefined ? "Run on demand" : `Next ${formatDateTime(item.next_run_at)}`}
                                            </span>
                                            <div className={"action-group"}>
                                                <button
                                                    className={"button button--secondary"}
                                                    disabled={bookmarkMutation.isPending}
                                                    onClick={() => {
                                                        bookmarkMutation.mutate({ isBookmarked, propertyId: item.id });
                                                    }}
                                                    type={"button"}
                                                >
                                                    {isBookmarked ? "Remove bookmark" : "Bookmark"}
                                                </button>
                                                <Link className={"button button--secondary"} to={`/runs?property_id=${encodeURIComponent(item.id)}`}>
                                                    {"History"}
                                                </Link>
                                                <button
                                                    className={"button button--secondary"}
                                                    disabled={ingestMutation.isPending}
                                                    onClick={() => {
                                                        ingestMutation.mutate({ propertyId: item.id });
                                                    }}
                                                    type={"button"}
                                                >
                                                    {"Run now"}
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </AsyncContent>
                </PageCard>
            </div>

            <LiveEventsPanel />
        </div>
    );
};
