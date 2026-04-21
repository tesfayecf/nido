import { memo, useEffect, useMemo, useRef, useState } from "react";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageCard } from "@/components/ui/PageCard";
import { buildSparklinePoints, buildRegionBenchmarks, filterAndSortListings, getBenchmarkKey, getDaysOnMarket, isValueListing, priceDeltaRatio, summarizeListings } from "@/features/listings/listingInsights";
import { useMapBounds } from "@/features/listings/hooks/useMapBounds";
import { usePropertyFilters } from "@/features/listings/hooks/usePropertyFilters";
import { PriceHistoryModal } from "@/features/listings/components/PriceHistoryModal";
import { formatCurrency } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/date";
import { connectBackofficeEvents } from "@/services/backoffice-events/events.service";
import { listingKeys } from "@/services/listings/listings.keys";
import { listListings } from "@/services/listings/listings.service";
import type { Listing, ListingListFilters } from "@/services/listings/listings.types";
import { useSessionStore } from "@/stores/session.store";
import { useSearchSessionStore } from "@/stores/search-session.store";

/**
 * Hosts the listing explorer route.
 *
 * @returns The dense market-intelligence listing explorer.
 */
export const ListingsPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const token = useSessionStore((state) => state.token);
    const { applyDraft, draft, filters, resetDraft, setDraftField } = usePropertyFilters();
    const bounds = useMapBounds();
    const compareIds = useSearchSessionStore((state) => state.compareIds);
    const clearCompare = useSearchSessionStore((state) => state.clearCompare);
    const sortOrder = useSearchSessionStore((state) => state.sortOrder);
    const setSortOrder = useSearchSessionStore((state) => state.setSortOrder);
    const toggleCompare = useSearchSessionStore((state) => state.toggleCompare);
    const [selectedHistoryListingId, setSelectedHistoryListingId] = useState("");
    const [updateToast, setUpdateToast] = useState<string | null>(null);

    useEffect(() => {
        setSortOrder(filters.sort);
    }, [filters.sort, setSortOrder]);

    const requestFilters: ListingListFilters = useMemo(() => ({
        limit: filters.limit,
        q: filters.q,
        source_id: filters.sourceId,
    }), [filters.limit, filters.q, filters.sourceId]);

    const listingsQuery = useQuery({
        placeholderData: keepPreviousData,
        queryFn: () => {
            return listListings(requestFilters);
        },
        queryKey: listingKeys.list(requestFilters),
    });

    useEffect(() => {
        if (token === null) {
            return undefined;
        }

        const controller = new AbortController();
        const connect = async (): Promise<void> => {
            try {
                await connectBackofficeEvents({
                    onEvent(event) {
                        if (event.type !== "ingestion.run.completed") {
                            return;
                        }

                        const sourceId = `${event.data.source_id ?? ""}`.trim();
                        if (filters.sourceId !== "" && filters.sourceId !== sourceId) {
                            return;
                        }

                        setUpdateToast(buildUpdateToastMessage(sourceId));
                        void queryClient.invalidateQueries({ queryKey: listingKeys.list(requestFilters) });
                    },
                    signal: controller.signal,
                });
            } catch {
                if (!controller.signal.aborted) {
                    setUpdateToast("Live updates are temporarily unavailable.");
                }
            }
        };

        void connect();
        return () => {
            controller.abort();
        };
    }, [filters.sourceId, queryClient, requestFilters, token]);

    const rawItems = listingsQuery.data?.items ?? [];
    const visibleItems = useMemo(() => {
        return filterAndSortListings(rawItems, filters);
    }, [filters, rawItems]);
    const summary = useMemo(() => summarizeListings(visibleItems), [visibleItems]);
    const benchmarks = useMemo(() => buildRegionBenchmarks(visibleItems), [visibleItems]);
    const compareItems = useMemo(() => {
        return visibleItems.filter((item) => compareIds.includes(item.id));
    }, [compareIds, visibleItems]);
    const dominantMarkets = useMemo(() => {
        return Array.from(benchmarks.values()).sort((left, right) => right.count - left.count).slice(0, 6);
    }, [benchmarks]);
    const listParentRef = useRef<HTMLDivElement | null>(null);
    const rowVirtualizer = useVirtualizer({
        count: visibleItems.length,
        estimateSize: () => 220,
        getScrollElement: () => listParentRef.current,
        overscan: 6,
    });

    return (
        <div className={"page-stack"}>
            <PageCard
                action={token === null ? <Link className={"button"} to={"/login"}>{"Sign in for live updates"}</Link> : undefined}
                description={"Iteration A focuses on a dense main view with URL-backed filters, session compare state, and virtualized search results. Advanced geospatial rendering remains map-ready while the backend lacks coordinates."}
                title={"Market Intelligence Explorer"}
            >
                <form
                    className={"market-filter-grid"}
                    onSubmit={(event) => {
                        event.preventDefault();
                        applyDraft();
                    }}
                >
                    <label className={"field field--dense"}>
                        <span className={"field__label"}>{"Search text"}</span>
                        <input
                            className={"field__control"}
                            onChange={(event) => {
                                setDraftField("q", event.target.value);
                            }}
                            placeholder={"Girona, duplex, terrace..."}
                            value={draft.q}
                        />
                    </label>
                    <label className={"field field--dense"}>
                        <span className={"field__label"}>{"Source"}</span>
                        <input
                            className={"field__control"}
                            onChange={(event) => {
                                setDraftField("sourceId", event.target.value);
                            }}
                            placeholder={"bootstrap-feed"}
                            value={draft.sourceId}
                        />
                    </label>
                    <label className={"field field--dense"}>
                        <span className={"field__label"}>{"Min price"}</span>
                        <input
                            aria-label={"Minimum price"}
                            className={"field__control"}
                            min={0}
                            onChange={(event) => {
                                setDraftField("minPrice", event.target.value);
                            }}
                            placeholder={"150000"}
                            step={1000}
                            type={"number"}
                            value={draft.minPrice}
                        />
                    </label>
                    <label className={"field field--dense"}>
                        <span className={"field__label"}>{"Max price"}</span>
                        <input
                            aria-label={"Maximum price"}
                            className={"field__control"}
                            min={0}
                            onChange={(event) => {
                                setDraftField("maxPrice", event.target.value);
                            }}
                            placeholder={"450000"}
                            step={1000}
                            type={"number"}
                            value={draft.maxPrice}
                        />
                    </label>
                    <label className={"field field--dense"}>
                        <span className={"field__label"}>{"Sort"}</span>
                        <select
                            className={"field__control"}
                            onChange={(event) => {
                                setDraftField("sort", event.target.value as typeof draft.sort);
                            }}
                            value={draft.sort}
                        >
                            <option value={"latest"}>{"Latest"}</option>
                            <option value={"price-asc"}>{"Price ↑"}</option>
                            <option value={"price-desc"}>{"Price ↓"}</option>
                            <option value={"value"}>{"Best value"}</option>
                        </select>
                    </label>
                    <label className={"field field--dense"}>
                        <span className={"field__label"}>{"Result limit"}</span>
                        <input
                            className={"field__control"}
                            min={25}
                            onChange={(event) => {
                                setDraftField("limit", event.target.value);
                            }}
                            step={25}
                            type={"number"}
                            value={draft.limit}
                        />
                    </label>
                    <label className={"field field--checkbox field--checkbox-compact"}>
                        <input
                            checked={draft.onlyValue}
                            onChange={(event) => {
                                setDraftField("onlyValue", event.target.checked);
                            }}
                            type={"checkbox"}
                        />
                        <span className={"field__label"}>{"Only show value anomalies"}</span>
                    </label>
                    <div className={"field field--actions field--actions-inline"}>
                        <button className={"button"} type={"submit"}>{"Apply"}</button>
                        <button
                            className={"button button--secondary"}
                            onClick={() => {
                                resetDraft();
                            }}
                            type={"button"}
                        >
                            {"Reset draft"}
                        </button>
                    </div>
                </form>
            </PageCard>

            {updateToast !== null ? (
                <div className={"update-toast"} role={"status"}>
                    <span>{updateToast}</span>
                    <button
                        className={"button button--secondary"}
                        onClick={() => {
                            setUpdateToast(null);
                        }}
                        type={"button"}
                    >
                        {"Dismiss"}
                    </button>
                </div>
            ) : null}

            <div className={"stat-grid stat-grid--compact"}>
                <article className={"stat-card"}>
                    <span className={"stat-card__label"}>{"Visible listings"}</span>
                    <strong className={"stat-card__value"}>{visibleItems.length}</strong>
                </article>
                <article className={"stat-card"}>
                    <span className={"stat-card__label"}>{"Average price"}</span>
                    <strong className={"stat-card__value"}>{summary.average === null ? "—" : formatCurrency(summary.average, summary.currency)}</strong>
                </article>
                <article className={"stat-card"}>
                    <span className={"stat-card__label"}>{"Value anomalies"}</span>
                    <strong className={"stat-card__value"}>{visibleItems.filter((item) => isValueListing(item, benchmarks)).length}</strong>
                </article>
                <article className={"stat-card"}>
                    <span className={"stat-card__label"}>{"Dominant sort"}</span>
                    <strong className={"stat-card__value stat-card__value--small"}>{sortOrder}</strong>
                </article>
            </div>

            <div className={"market-layout"}>
                <PageCard
                    description={"Listings stay virtualized to keep the sidebar responsive as the working set grows."}
                    title={listingsQuery.isFetching ? "Refreshing market slice..." : `Results · ${visibleItems.length}`}
                >
                    {listingsQuery.isLoading ? <p className={"muted-copy"}>{"Loading listings..."}</p> : null}
                    {listingsQuery.isError ? <p className={"error-banner"}>{"Could not load listings."}</p> : null}
                    {listingsQuery.isSuccess && visibleItems.length === 0 ? <EmptyState message={"No listings matched the active market view."} /> : null}
                    {visibleItems.length > 0 ? (
                        <div className={"virtual-list-shell"}>
                            <div className={"results-toolbar"}>
                                <span className={"muted-copy"}>{"Compact mode: price, market delta, days on market, and regional sparkline are all visible inline."}</span>
                                <strong className={"results-toolbar__meta"}>{`${dominantMarkets.length} tracked regional clusters`}</strong>
                            </div>
                            <div className={"virtual-list"} ref={listParentRef}>
                                <div
                                    className={"virtual-list__inner"}
                                    style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                                >
                                    {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                                        const item = visibleItems[virtualItem.index];
                                        if (item === undefined) {
                                            return null;
                                        }

                                        const benchmarkKey = getBenchmarkKey(item.location);
                                        return (
                                            <div
                                                className={"virtual-list__row"}
                                                key={item.id}
                                                style={{ height: `${virtualItem.size}px`, transform: `translateY(${virtualItem.start}px)` }}
                                            >
                                                <ListingRow
                                                    benchmarkLabel={benchmarks.get(benchmarkKey)?.label ?? item.location}
                                                    benchmarkSparkline={benchmarks.get(benchmarkKey)?.sparkline ?? [item.price_amount]}
                                                    compareSelected={compareIds.includes(item.id)}
                                                    isValue={isValueListing(item, benchmarks)}
                                                    item={item}
                                                    onOpenHistory={setSelectedHistoryListingId}
                                                    onToggleCompare={toggleCompare}
                                                    priceDelta={priceDeltaRatio(item, benchmarks)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </PageCard>

                <div className={"market-layout__sidebar"}>
                    <PageCard
                        description={"The session store already tracks bounds, zoom, and search-as-I-move behavior so the UI stays ready for true map fetching when coordinates arrive."}
                        title={"Viewport Intelligence"}
                    >
                        <div className={"viewport-panel"}>
                            <div className={"viewport-panel__metrics"}>
                                <div>
                                    <span className={"key-value-grid__label"}>{"Bounds"}</span>
                                    <strong className={"key-value-grid__value"}>{`${bounds.bounds.south.toFixed(2)} · ${bounds.bounds.west.toFixed(2)} → ${bounds.bounds.north.toFixed(2)} · ${bounds.bounds.east.toFixed(2)}`}</strong>
                                </div>
                                <div>
                                    <span className={"key-value-grid__label"}>{"Zoom"}</span>
                                    <strong className={"key-value-grid__value"}>{bounds.zoomLevel}</strong>
                                </div>
                            </div>
                            <div className={"viewport-panel__controls"}>
                                <button className={"button button--secondary"} onClick={bounds.moveNorth} type={"button"}>{"Pan north"}</button>
                                <button className={"button button--secondary"} onClick={bounds.moveWest} type={"button"}>{"Pan west"}</button>
                                <button className={"button button--secondary"} onClick={bounds.moveEast} type={"button"}>{"Pan east"}</button>
                                <button className={"button button--secondary"} onClick={bounds.moveSouth} type={"button"}>{"Pan south"}</button>
                                <button className={"button button--secondary"} onClick={bounds.zoomIn} type={"button"}>{"Zoom in"}</button>
                                <button className={"button button--secondary"} onClick={bounds.zoomOut} type={"button"}>{"Zoom out"}</button>
                            </div>
                            <label className={"field field--checkbox field--checkbox-compact"}>
                                <input
                                    checked={bounds.searchAsMove}
                                    onChange={(event) => {
                                        bounds.setSearchAsMove(event.target.checked);
                                    }}
                                    type={"checkbox"}
                                />
                                <span className={"field__label"}>{"Search as I move the viewport"}</span>
                            </label>
                            <div className={"cluster-grid"}>
                                {dominantMarkets.map((market) => {
                                    return (
                                        <button className={"cluster-card"} key={market.key} type={"button"}>
                                            <span className={"cluster-card__label"}>{market.label}</span>
                                            <strong className={"cluster-card__value"}>{market.count}{" listings"}</strong>
                                            <span className={"cluster-card__meta"}>{formatCurrency(market.averagePrice, summary.currency)}</span>
                                            <svg aria-hidden className={"sparkline"} viewBox={"0 0 100 32"}>
                                                <polyline className={"sparkline__line"} fill={"none"} points={buildSparklinePoints(market.sparkline)} strokeWidth={"2"} />
                                            </svg>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </PageCard>

                    <PageCard
                        action={compareItems.length > 0 ? <button className={"button button--secondary"} onClick={clearCompare} type={"button"}>{"Clear"}</button> : undefined}
                        description={"Comparison stays side-by-side in the search session so analysts can keep scanning the list while shortlisting candidates."}
                        title={"Side-by-Side Compare"}
                    >
                        {compareItems.length === 0 ? <EmptyState message={"Select up to three listings from the result rows to compare them here."} /> : null}
                        {compareItems.length > 0 ? (
                            <div className={"compare-grid"}>
                                {compareItems.map((item) => {
                                    return (
                                        <article className={"compare-card"} key={item.id}>
                                            <h3 className={"list-row__title"}>{item.title}</h3>
                                            <p className={"list-row__meta"}>{item.location}</p>
                                            <dl className={"compare-card__metrics"}>
                                                <div>
                                                    <dt>{"Price"}</dt>
                                                    <dd>{formatCurrency(item.price_amount, item.currency)}</dd>
                                                </div>
                                                <div>
                                                    <dt>{"Days on market"}</dt>
                                                    <dd>{getDaysOnMarket(item)}</dd>
                                                </div>
                                                <div>
                                                    <dt>{"Last seen"}</dt>
                                                    <dd>{formatDateTime(item.last_seen_at)}</dd>
                                                </div>
                                            </dl>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : null}
                    </PageCard>
                </div>
            </div>

            {selectedHistoryListingId !== "" ? (
                <PriceHistoryModal
                    listingId={selectedHistoryListingId}
                    onClose={() => {
                        setSelectedHistoryListingId("");
                    }}
                />
            ) : null}
        </div>
    );
};

interface ListingRowProps {
    readonly benchmarkLabel: string;
    readonly benchmarkSparkline: number[];
    readonly compareSelected: boolean;
    readonly isValue: boolean;
    readonly item: Listing;
    readonly onOpenHistory: (listingId: string) => void;
    readonly onToggleCompare: (listingId: string) => void;
    readonly priceDelta: number;
}

const ListingRow = memo(({
    benchmarkLabel,
    benchmarkSparkline,
    compareSelected,
    isValue,
    item,
    onOpenHistory,
    onToggleCompare,
    priceDelta,
}: ListingRowProps): JSX.Element => {
    return (
        <article className={"listing-dense-row"}>
            <div className={"listing-dense-row__primary"}>
                <div>
                    <div className={"listing-dense-row__headline"}>
                        <h3 className={"list-row__title"}>
                            <Link to={`/listings/${item.id}`}>{item.title}</Link>
                        </h3>
                        {isValue ? <span className={"value-badge"}>{"Value badge"}</span> : null}
                    </div>
                    <p className={"list-row__meta"}>{item.location}{" · source "}{item.source_id}</p>
                </div>
                <strong className={"listing-dense-row__price"}>{formatCurrency(item.price_amount, item.currency)}</strong>
            </div>

            <div className={"listing-dense-row__metrics"}>
                <Metric label={"Delta vs region"} value={`${priceDelta < 0 ? "" : "+"}${Math.round(priceDelta * 100)}%`} />
                <Metric label={"Days on market"} value={`${getDaysOnMarket(item)}`} />
                <Metric label={"First seen"} value={formatDateTime(item.first_seen_at)} />
                <Metric label={"Last seen"} value={formatDateTime(item.last_seen_at)} />
            </div>

            <div className={"listing-dense-row__footer"}>
                <div className={"listing-dense-row__trend"}>
                    <span className={"key-value-grid__label"}>{`Regional trend · ${benchmarkLabel}`}</span>
                    <svg aria-hidden className={"sparkline"} viewBox={"0 0 100 32"}>
                        <polyline className={"sparkline__line"} fill={"none"} points={buildSparklinePoints(benchmarkSparkline)} strokeWidth={"2"} />
                    </svg>
                </div>
                <div className={"action-group"}>
                    <button
                        aria-pressed={compareSelected}
                        className={"button button--secondary"}
                        onClick={() => {
                            onToggleCompare(item.id);
                        }}
                        type={"button"}
                    >
                        {compareSelected ? "Remove compare" : "Compare"}
                    </button>
                    <button
                        className={"button button--secondary"}
                        onClick={() => {
                            onOpenHistory(item.id);
                        }}
                        type={"button"}
                    >
                        {"Price history"}
                    </button>
                    <a className={"text-link"} href={item.url} rel={"noreferrer"} target={"_blank"}>{"Open original"}</a>
                </div>
            </div>
        </article>
    );
});

ListingRow.displayName = "ListingRow";

interface MetricProps {
    readonly label: string;
    readonly value: string;
}

const Metric = ({ label, value }: MetricProps): JSX.Element => {
    return (
        <div className={"inline-metric"}>
            <span className={"inline-metric__label"}>{label}</span>
            <strong className={"inline-metric__value"}>{value}</strong>
        </div>
    );
};

const buildUpdateToastMessage = (sourceId: string): string => {
    return sourceId === "" ? "Fresh scraper results are available for the active market view." : `Fresh scraper results are available from ${sourceId}.`;
};
