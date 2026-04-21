import { useEffect, useId, useRef } from "react";

import { useQuery } from "@tanstack/react-query";

import { AsyncContent } from "@/components/ui/AsyncContent";
import { PageCard } from "@/components/ui/PageCard";
import { buildPriceHistorySeries, buildSparklinePoints } from "@/features/listings/listingInsights";
import { formatCurrency } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/date";
import { listingKeys } from "@/services/listings/listings.keys";
import { getListingDetail } from "@/services/listings/listings.service";

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
    const titleId = useId();
    const descriptionId = useId();
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const detailQuery = useQuery({
        enabled: listingId !== "",
        queryFn: () => {
            return getListingDetail(listingId);
        },
        queryKey: listingKeys.detail(listingId),
    });

    const detail = detailQuery.data;

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        document.body.style.overflow = "hidden";
        closeButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
            previousActiveElement?.focus();
        };
    }, [onClose]);

    return (
        <div aria-describedby={descriptionId} aria-labelledby={titleId} aria-modal className={"modal-overlay"} role={"dialog"}>
            <PageCard
                action={<button className={"button button--secondary"} onClick={onClose} ref={closeButtonRef} type={"button"}>{"Close"}</button>}
                description={"Price history stays in-context so analysts can keep their list and compare state intact."}
                title={detail?.item.title ?? "Price History"}
                titleId={titleId}
            >
                <p className={"sr-only"} id={descriptionId}>{"Review the selected listing price history. Press escape to close this dialog."}</p>
                <AsyncContent
                    emptyMessage={"This listing does not have recorded price changes yet."}
                    errorMessage={"Could not load price history."}
                    isEmpty={detailQuery.isSuccess && detailQuery.data.price_history.length === 0}
                    isError={detailQuery.isError}
                    isLoading={detailQuery.isLoading}
                    loadingMessage={"Loading price history..."}
                >
                    {detail === undefined ? null : (
                        <div className={"modal-stack"}>
                            <div className={"price-history-hero"}>
                                <div>
                                    <span className={"stat-card__label"}>{"Current price"}</span>
                                    <strong className={"price-history-hero__value"}>{formatCurrency(detail.item.price_amount, detail.item.currency)}</strong>
                                </div>
                                <svg aria-hidden className={"sparkline sparkline--hero"} viewBox={"0 0 100 32"}>
                                    <polyline
                                        className={"sparkline__line"}
                                        fill={"none"}
                                        points={buildSparklinePoints(buildPriceHistorySeries(detail.price_history, detail.item.price_amount))}
                                        strokeWidth={"2"}
                                    />
                                </svg>
                            </div>
                            <div className={"item-list"}>
                                {detail.price_history.map((event) => {
                                    return (
                                        <article className={"list-row"} key={event.id}>
                                            <div className={"list-row__main"}>
                                                <div>
                                                    <h3 className={"list-row__title"}>{formatCurrency(event.new_amount, detail.item.currency)}</h3>
                                                    <p className={"list-row__meta"}>{"Changed "}{formatDateTime(event.changed_at)}</p>
                                                </div>
                                                <strong className={"list-row__price"}>
                                                    {event.previous_amount === undefined ? "Initial capture" : `from ${formatCurrency(event.previous_amount, detail.item.currency)}`}
                                                </strong>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </AsyncContent>
            </PageCard>
        </div>
    );
};
