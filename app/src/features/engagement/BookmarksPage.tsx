import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { AsyncContent } from "@/components/ui/AsyncContent";
import { PageCard } from "@/components/ui/PageCard";
import { formatCurrency } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/date";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { deleteBookmark, listBookmarks } from "@/services/bookmarks/bookmarks.service";

/**
 * Hosts the bookmarks route.
 *
 * @returns The placeholder bookmarks screen.
 */
export const BookmarksPage = (): JSX.Element => {
    const queryClient = useQueryClient();
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

    return (
        <div className={"page-stack"}>
            <PageCard description={"Bookmarks join the saved listing id with its latest canonical listing snapshot."} title={"Bookmarks"}>
                <AsyncContent
                    emptyMessage={"No properties have been bookmarked yet."}
                    errorMessage={"Could not load bookmarks."}
                    isEmpty={bookmarksQuery.isSuccess && bookmarks.length === 0}
                    isError={bookmarksQuery.isError}
                    isLoading={bookmarksQuery.isLoading}
                    loadingMessage={"Loading bookmarks..."}
                >
                    <div className={"item-list"}>
                        {bookmarks.map((item) => {
                            return (
                                <article className={"list-row"} key={item.listing_id}>
                                    <div className={"list-row__main"}>
                                        <div>
                                            <h3 className={"list-row__title"}>
                                                <Link to={`/listings/${item.listing_id}`}>{item.title}</Link>
                                            </h3>
                                            <p className={"list-row__meta"}>{item.location}{" · saved "}{formatDateTime(item.bookmarked_at)}</p>
                                        </div>
                                        <strong className={"list-row__price"}>{formatCurrency(item.price_amount, item.currency)}</strong>
                                    </div>
                                    <div className={"list-row__footer"}>
                                        <a className={"text-link"} href={item.url} rel={"noreferrer"} target={"_blank"}>{"Open original"}</a>
                                        <button
                                            className={"button button--secondary"}
                                            disabled={deleteMutation.isPending}
                                            onClick={() => {
                                                deleteMutation.mutate(item.listing_id);
                                            }}
                                            type={"button"}
                                        >
                                            {"Remove"}
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </AsyncContent>
            </PageCard>
        </div>
    );
};
