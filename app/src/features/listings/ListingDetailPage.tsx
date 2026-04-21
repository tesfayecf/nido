import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageCard } from "@/components/ui/PageCard";
import { formatCurrency } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/date";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { createBookmark, deleteBookmark, listBookmarks } from "@/services/bookmarks/bookmarks.service";
import { listingKeys } from "@/services/listings/listings.keys";
import { getListingDetail } from "@/services/listings/listings.service";
import { useSessionStore } from "@/stores/session.store";

/**
 * Hosts the listing detail route.
 *
 * @returns The placeholder listing detail screen.
 */
export const ListingDetailPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const { listingId = "" } = useParams();
    const token = useSessionStore((state) => state.token);
    const detailQuery = useQuery({
        enabled: listingId !== "",
        queryFn: () => {
            return getListingDetail(listingId);
        },
        queryKey: listingKeys.detail(listingId),
    });
    const bookmarksQuery = useQuery({
        enabled: token !== null && listingId !== "",
        queryFn: listBookmarks,
        queryKey: bookmarkKeys.all(),
    });
    const bookmarkMutation = useMutation({
        mutationFn: async () => {
            const existingBookmark = bookmarksQuery.data?.find((item) => item.listing_id === listingId);
            if (existingBookmark !== undefined) {
                await deleteBookmark(listingId);
                return;
            }

            await createBookmark(listingId);
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: bookmarkKeys.all() });
        },
    });

    if (listingId === "") {
        return (
            <div className={"page-stack"}>
                <PageCard description={"The route was loaded without a listing identifier."} title={"Listing detail unavailable"}>
                    <p className={"error-banner"}>{"A listing id is required."}</p>
                </PageCard>
            </div>
        );
    }

    if (detailQuery.isLoading) {
        return (
            <div className={"page-stack"}>
                <PageCard description={"The listing detail and price history are loading."} title={"Listing Detail"}>
                    <p className={"muted-copy"}>{"Loading listing..."}</p>
                </PageCard>
            </div>
        );
    }

    if (detailQuery.isError || detailQuery.data === undefined) {
        return (
            <div className={"page-stack"}>
                <PageCard description={"The listing detail could not be loaded."} title={"Listing Detail"}>
                    <p className={"error-banner"}>{"Could not load the selected listing."}</p>
                </PageCard>
            </div>
        );
    }

    const isBookmarked = bookmarksQuery.data?.some((item) => item.listing_id === listingId) ?? false;
    const listing = detailQuery.data.item;

    return (
        <div className={"page-stack"}>
            <PageCard
                action={
                    <div className={"action-group"}>
                        <Link className={"button button--secondary"} to={"/listings"}>{"Back to listings"}</Link>
                        <a className={"button button--secondary"} href={listing.url} rel={"noreferrer"} target={"_blank"}>{"Open original"}</a>
                        {token !== null ? (
                            <button
                                className={"button"}
                                disabled={bookmarkMutation.isPending}
                                onClick={() => {
                                    bookmarkMutation.mutate();
                                }}
                                type={"button"}
                            >
                                {bookmarkMutation.isPending ? "Saving..." : isBookmarked ? "Remove bookmark" : "Bookmark property"}
                            </button>
                        ) : 
                            <Link className={"button"} to={"/login"}>{"Sign in to bookmark"}</Link>
                        }
                    </div>
                }
                description={"Canonical listing data normalized by the backend, with persisted price history below."}
                title={listing.title}
            >
                <div className={"key-value-grid"}>
                    <div>
                        <span className={"key-value-grid__label"}>{"Current price"}</span>
                        <strong className={"key-value-grid__value"}>{formatCurrency(listing.price_amount, listing.currency)}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Location"}</span>
                        <strong className={"key-value-grid__value"}>{listing.location}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"First seen"}</span>
                        <strong className={"key-value-grid__value"}>{formatDateTime(listing.first_seen_at)}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Last seen"}</span>
                        <strong className={"key-value-grid__value"}>{formatDateTime(listing.last_seen_at)}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Source"}</span>
                        <strong className={"key-value-grid__value"}>{listing.source_id}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"External id"}</span>
                        <strong className={"key-value-grid__value"}>{listing.external_id}</strong>
                    </div>
                </div>
            </PageCard>

            <PageCard description={"Every persisted price change for this listing."} title={"Price History"}>
                {detailQuery.data.price_history.length === 0 ? <EmptyState message={"This listing does not have recorded price changes yet."} /> : null}
                {detailQuery.data.price_history.length > 0 ? (
                    <div className={"item-list"}>
                        {detailQuery.data.price_history.map((event) => {
                            return (
                                <article className={"list-row"} key={event.id}>
                                    <div className={"list-row__main"}>
                                        <div>
                                            <h3 className={"list-row__title"}>{formatCurrency(event.new_amount, listing.currency)}</h3>
                                            <p className={"list-row__meta"}>{"Changed "}{formatDateTime(event.changed_at)}</p>
                                        </div>
                                        <strong className={"list-row__price"}>
                                            {event.previous_amount === undefined ? "Initial capture" : `from ${formatCurrency(event.previous_amount, listing.currency)}`}
                                        </strong>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : null}
            </PageCard>
        </div>
    );
};