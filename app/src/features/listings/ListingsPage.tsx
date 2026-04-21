import { useEffect, useState } from "react";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageCard } from "@/components/ui/PageCard";
import { formatCurrency } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/date";
import { readNumberParam, readStringParam, writeParam } from "@/lib/routing/searchParams";
import { NullMapPanel } from "@/features/map/NullMapPanel";
import { listingKeys } from "@/services/listings/listings.keys";
import { listListings } from "@/services/listings/listings.service";
import type { Listing, ListingListFilters } from "@/services/listings/listings.types";
import { useSessionStore } from "@/stores/session.store";

/**
 * Hosts the listing explorer route.
 *
 * @returns The placeholder listing explorer screen.
 */
export const ListingsPage = (): JSX.Element => {
    const [searchParams, setSearchParams] = useSearchParams();
    const token = useSessionStore((state) => state.token);
    const filters: ListingListFilters = {
        limit: readNumberParam(searchParams, "limit", 25),
        q: readStringParam(searchParams, "q"),
        source_id: readStringParam(searchParams, "source_id"),
    };
    const [draftQuery, setDraftQuery] = useState(filters.q);
    const [draftSourceId, setDraftSourceId] = useState(filters.source_id);
    const [draftLimit, setDraftLimit] = useState(`${filters.limit}`);
    const listingsQuery = useQuery({
        placeholderData: keepPreviousData,
        queryFn: () => {
            return listListings(filters);
        },
        queryKey: listingKeys.list(filters),
    });

    useEffect(() => {
        setDraftQuery(filters.q);
        setDraftSourceId(filters.source_id);
        setDraftLimit(`${filters.limit}`);
    }, [filters.limit, filters.q, filters.source_id]);

    const items = listingsQuery.data?.items ?? [];
    const summary = summarizeListings(items);

    return (
        <div className={"page-stack"}>
            <PageCard
                action={token === null ? <Link className={"button"} to={"/login"}>{"Sign in for tracking"}</Link> : undefined}
                description={"Search current listings by text and source. The first iteration intentionally mirrors the current backend contract instead of inventing synthetic filters."}
                title={"Listings Explorer"}
            >
                <form
                    className={"form-grid form-grid--inline"}
                    onSubmit={(event) => {
                        event.preventDefault();
                        const nextParams = new URLSearchParams(searchParams);
                        writeParam(nextParams, "q", draftQuery);
                        writeParam(nextParams, "source_id", draftSourceId);
                        writeParam(nextParams, "limit", draftLimit);
                        setSearchParams(nextParams);
                    }}
                >
                    <label className={"field"}>
                        <span className={"field__label"}>{"Search text"}</span>
                        <input
                            className={"field__control"}
                            onChange={(event) => {
                                setDraftQuery(event.target.value);
                            }}
                            placeholder={"Bilbao, garden, duplex..."}
                            value={draftQuery}
                        />
                    </label>

                    <label className={"field"}>
                        <span className={"field__label"}>{"Source id"}</span>
                        <input
                            className={"field__control"}
                            onChange={(event) => {
                                setDraftSourceId(event.target.value);
                            }}
                            placeholder={"bootstrap-feed"}
                            value={draftSourceId}
                        />
                    </label>

                    <label className={"field"}>
                        <span className={"field__label"}>{"Limit"}</span>
                        <input
                            className={"field__control"}
                            min={1}
                            onChange={(event) => {
                                setDraftLimit(event.target.value);
                            }}
                            step={1}
                            type={"number"}
                            value={draftLimit}
                        />
                    </label>

                    <div className={"field field--actions"}>
                        <button className={"button"} type={"submit"}>{"Apply filters"}</button>
                    </div>
                </form>
            </PageCard>

            <div className={"stat-grid"}>
                <article className={"stat-card"}>
                    <span className={"stat-card__label"}>{"Visible listings"}</span>
                    <strong className={"stat-card__value"}>{items.length}</strong>
                </article>
                <article className={"stat-card"}>
                    <span className={"stat-card__label"}>{"Min price"}</span>
                    <strong className={"stat-card__value"}>{summary.min === null ? "—" : formatCurrency(summary.min, summary.currency)}</strong>
                </article>
                <article className={"stat-card"}>
                    <span className={"stat-card__label"}>{"Average price"}</span>
                    <strong className={"stat-card__value"}>{summary.average === null ? "—" : formatCurrency(summary.average, summary.currency)}</strong>
                </article>
                <article className={"stat-card"}>
                    <span className={"stat-card__label"}>{"Max price"}</span>
                    <strong className={"stat-card__value"}>{summary.max === null ? "—" : formatCurrency(summary.max, summary.currency)}</strong>
                </article>
            </div>

            <PageCard
                description={"Results are returned by the backend in descending recency order."}
                title={listingsQuery.isFetching ? "Refreshing listings..." : "Results"}
            >
                {listingsQuery.isLoading ? <p className={"muted-copy"}>{"Loading listings..."}</p> : null}
                {listingsQuery.isError ? <p className={"error-banner"}>{"Could not load listings."}</p> : null}
                {listingsQuery.isSuccess && items.length === 0 ? <EmptyState message={"No listings matched the current filters."} /> : null}
                {items.length > 0 ? (
                    <div className={"item-list"}>
                        {items.map((item) => {
                            return (
                                <article className={"list-row"} key={item.id}>
                                    <div className={"list-row__main"}>
                                        <div>
                                            <h3 className={"list-row__title"}>
                                                <Link to={`/listings/${item.id}`}>{item.title}</Link>
                                            </h3>
                                            <p className={"list-row__meta"}>{item.location}{" · source "}{item.source_id}</p>
                                        </div>
                                        <strong className={"list-row__price"}>{formatCurrency(item.price_amount, item.currency)}</strong>
                                    </div>
                                    <div className={"list-row__footer"}>
                                        <span>{"First seen "}{formatDateTime(item.first_seen_at)}</span>
                                        <span>{"Last seen "}{formatDateTime(item.last_seen_at)}</span>
                                        <a className={"text-link"} href={item.url} rel={"noreferrer"} target={"_blank"}>{"Open original"}</a>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : null}
            </PageCard>

            <NullMapPanel />
        </div>
    );
};

interface ListingSummary {
    readonly average: number | null;
    readonly currency: string;
    readonly max: number | null;
    readonly min: number | null;
}

const summarizeListings = (items: Listing[]): ListingSummary => {
    const [firstItem, ...remainingItems] = items;

    if (firstItem === undefined) {
        return { average: null, currency: "EUR", max: null, min: null };
    }

    let total = firstItem.price_amount;
    let min = firstItem.price_amount;
    let max = firstItem.price_amount;
    for (const item of remainingItems) {
        total += item.price_amount;
        if (item.price_amount < min) {
            min = item.price_amount;
        }

        if (item.price_amount > max) {
            max = item.price_amount;
        }
    }

    return {
        average: Math.round(total / items.length),
        currency: firstItem.currency,
        max,
        min,
    };
};