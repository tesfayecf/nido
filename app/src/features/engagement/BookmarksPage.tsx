import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { AsyncContent } from "@/components/ui/AsyncContent";
import { Button } from "@/components/ui/Button";
import { ItemList } from "@/components/ui/ItemList";
import { ListRow, ListRowFooter, ListRowMain } from "@/components/ui/ListRow";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { formatCurrency } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/date";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { deleteBookmark, listBookmarks } from "@/services/bookmarks/bookmarks.service";

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
        <PageStack>
            <PageCard description={"Bookmarks save properties directly, without any watchlist or listing intermediary."} title={"Bookmarks"}>
                <AsyncContent
                    emptyMessage={"No properties have been bookmarked yet."}
                    errorMessage={"Could not load bookmarks."}
                    isEmpty={bookmarksQuery.isSuccess && bookmarks.length === 0}
                    isError={bookmarksQuery.isError}
                    isLoading={bookmarksQuery.isLoading}
                    loadingMessage={"Loading bookmarks..."}
                >
                    <ItemList>
                        {bookmarks.map((item) => {
                            return (
                                <ListRow key={item.property_id}>
                                    <ListRowMain>
                                        <div>
                                            <h3 className={"list-row__title"}><Link to={`/properties/${item.property_id}`}>{item.title}</Link></h3>
                                            <p className={"list-row__meta"}>{item.location}{" · saved "}{formatDateTime(item.bookmarked_at)}</p>
                                        </div>
                                        <strong className={"list-row__price"}>{item.currency === "" ? `${item.price_amount}` : formatCurrency(item.price_amount, item.currency)}</strong>
                                    </ListRowMain>
                                    <ListRowFooter>
                                        <a className={"text-link"} href={item.url} rel={"noreferrer"} target={"_blank"}>{"Open original"}</a>
                                        <Button disabled={deleteMutation.isPending} onClick={() => { deleteMutation.mutate(item.property_id); }} variant={"secondary"}>{"Remove"}</Button>
                                    </ListRowFooter>
                                </ListRow>
                            );
                        })}
                    </ItemList>
                </AsyncContent>
            </PageCard>
        </PageStack>
    );
};
