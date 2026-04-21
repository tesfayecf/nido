import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageCard } from "@/components/ui/PageCard";
import { formatCurrency } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/date";
import { getListingDetail } from "@/services/listings/listings.service";
import { listingKeys } from "@/services/listings/listings.keys";
import { buildPriceHistorySeries, buildSparklinePoints } from "@/features/listings/listingInsights";

interface PriceHistoryModalProps {
    readonly listingId: string;
    readonly onClose: () => void;
}

/**
 * Shows price-history details without leaving the main search surface.
 *
 * @param props The selected listing id and close handler.
 * @returns A modal-style price history panel.
 */
export const PriceHistoryModal = ({ listingId, onClose }: PriceHistoryModalProps): JSX.Element => {
    const detailQuery = useQuery({
        enabled: listingId !== "",
        queryFn: () => {
            return getListingDetail(listingId);
        },
        queryKey: listingKeys.detail(listingId),
    });

    return (
        <div aria-modal className={"modal-overlay"} role={"dialog"}>
            <PageCard
                action={<button className={"button button--secondary"} onClick={onClose} type={"button"}>{"Close"}</button>}
                description={"Price history stays in-context so analysts can keep their list and compare state intact."}
                title={detailQuery.data?.item.title ?? "Price History"}
            >
                {detailQuery.isLoading ? <p className={"muted-copy"}>{"Loading price history..."}</p> : null}
                {detailQuery.isError ? <p className={"error-banner"}>{"Could not load price history."}</p> : null}
                {detailQuery.data !== undefined ? (
                    <div className={"modal-stack"}>
                        <div className={"price-history-hero"}>
                            <div>
                                <span className={"stat-card__label"}>{"Current price"}</span>
                                <strong className={"price-history-hero__value"}>{formatCurrency(detailQuery.data.item.price_amount, detailQuery.data.item.currency)}</strong>
                            </div>
                            <svg aria-hidden className={"sparkline sparkline--hero"} viewBox={"0 0 100 32"}>
                                <polyline
                                    className={"sparkline__line"}
                                    fill={"none"}
                                    points={buildSparklinePoints(buildPriceHistorySeries(detailQuery.data.price_history, detailQuery.data.item.price_amount))}
                                    strokeWidth={"2"}
                                />
                            </svg>
                        </div>
                        {detailQuery.data.price_history.length === 0 ? <EmptyState message={"This listing does not have recorded price changes yet."} /> : null}
                        {detailQuery.data.price_history.length > 0 ? (
                            <div className={"item-list"}>
                                {detailQuery.data.price_history.map((event) => {
                                    return (
                                        <article className={"list-row"} key={event.id}>
                                            <div className={"list-row__main"}>
                                                <div>
                                                    <h3 className={"list-row__title"}>{formatCurrency(event.new_amount, detailQuery.data.item.currency)}</h3>
                                                    <p className={"list-row__meta"}>{"Changed "}{formatDateTime(event.changed_at)}</p>
                                                </div>
                                                <strong className={"list-row__price"}>
                                                    {event.previous_amount === undefined ? "Initial capture" : `from ${formatCurrency(event.previous_amount, detailQuery.data.item.currency)}`}
                                                </strong>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </PageCard>
        </div>
    );
};
