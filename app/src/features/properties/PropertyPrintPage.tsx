import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { PriceHistoryChart } from "@/features/properties/PriceHistoryChart";
import { buildPriceHistoryPoints } from "@/features/properties/propertyHistory";
import { formatCurrency } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/date";
import { propertyKeys } from "@/services/properties/properties.keys";
import { getProperty, getPropertySummary, listPropertySnapshots, listPropertySummaries } from "@/services/properties/properties.service";

export const PropertyPrintPage = (): JSX.Element => {
    const { propertyId = "" } = useParams();
    const [searchParams] = useSearchParams();
    const selectedIds = useMemo(
        () => Array.from(new Set((searchParams.get("ids") ?? "").split(",").map((item) => item.trim()).filter((item) => item !== ""))),
        [searchParams],
    );
    const singlePropertyQuery = useQuery({
        enabled: propertyId !== "",
        queryFn: () => getProperty(propertyId),
        queryKey: propertyKeys.detail(propertyId),
    });
    const singleSummaryQuery = useQuery({
        enabled: propertyId !== "",
        queryFn: () => getPropertySummary(propertyId),
        queryKey: propertyKeys.summary(propertyId),
    });
    const singleSnapshotsQuery = useQuery({
        enabled: propertyId !== "",
        queryFn: () => listPropertySnapshots(propertyId),
        queryKey: propertyKeys.snapshots(propertyId),
    });
    const summariesQuery = useQuery({
        enabled: propertyId === "" && selectedIds.length > 0,
        queryFn: () => listPropertySummaries(),
        queryKey: propertyKeys.summaries(),
    });
    const portfolioSummaries = useMemo(() => {
        const wanted = new Set(selectedIds);
        return (summariesQuery.data ?? []).filter((summary) => wanted.has(summary.property.id));
    }, [selectedIds, summariesQuery.data]);
    const priceHistoryPoints = useMemo(() => buildPriceHistoryPoints(singleSnapshotsQuery.data ?? []), [singleSnapshotsQuery.data]);

    return (
        <PageStack>
            <PageCard
                action={(
                    <div className={"action-group print-hidden"}>
                        <Button onClick={() => { window.print(); }} variant={"secondary"}>{"Print / Save as PDF"}</Button>
                        <Button as={Link} to={propertyId !== "" ? `/properties/${propertyId}` : "/properties"} variant={"ghost"}>{"Close"}</Button>
                    </div>
                )}
                description={"Print-optimized property summaries with the latest notes, decisions, and pricing context."}
                title={propertyId !== "" ? "Printable property summary" : "Printable portfolio summary"}
            >
                {singlePropertyQuery.isError || singleSummaryQuery.isError || summariesQuery.isError ? <ErrorBanner>{"Could not prepare the printable view."}</ErrorBanner> : null}
                {propertyId === "" && selectedIds.length === 0 ? <EmptyState message={"Open this view from the filtered portfolio or a property detail page."} /> : null}
                {propertyId !== "" && singlePropertyQuery.data !== undefined && singleSummaryQuery.data !== undefined ? (
                    <article className={"print-summary"}>
                        <header className={"print-summary__header"}>
                            <div>
                                <h2>{singlePropertyQuery.data.label.trim() || singlePropertyQuery.data.url || "Manual property"}</h2>
                                <p className={"muted-copy"}>{singleSummaryQuery.data.current_values.location ?? "Location unavailable"}</p>
                            </div>
                            <div className={"print-summary__metrics"}>
                                <strong>{singleSummaryQuery.data.decision.current_price === undefined ? "—" : formatCurrency(singleSummaryQuery.data.decision.current_price, "EUR")}</strong>
                                <span>{singleSummaryQuery.data.latest_change_summary}</span>
                            </div>
                        </header>
                        <div className={"dashboard-grid dashboard-grid--double"}>
                            <section>
                                <h3>{"Latest snapshot"}</h3>
                                <ul className={"print-summary__list"}>
                                    {Object.entries(singleSummaryQuery.data.current_values).slice(0, 8).map(([key, value]) => <li key={key}><strong>{key}</strong><span>{value}</span></li>)}
                                </ul>
                            </section>
                            <section>
                                <h3>{"Notes & decisions"}</h3>
                                <ul className={"print-summary__list"}>
                                    <li><strong>{"Decision"}</strong><span>{singlePropertyQuery.data.metadata?.deal_thesis ?? "—"}</span></li>
                                    <li><strong>{"Acquisition notes"}</strong><span>{singlePropertyQuery.data.metadata?.acquisition_notes ?? "—"}</span></li>
                                    <li><strong>{"Target price"}</strong><span>{singlePropertyQuery.data.metadata?.target_price === undefined ? "—" : formatCurrency(singlePropertyQuery.data.metadata.target_price, "EUR")}</span></li>
                                    <li><strong>{"Last run"}</strong><span>{singlePropertyQuery.data.last_run_at === undefined ? "—" : formatDateTime(singlePropertyQuery.data.last_run_at)}</span></li>
                                </ul>
                            </section>
                        </div>
                        <section>
                            <h3>{"Price evolution"}</h3>
                            {priceHistoryPoints.length === 0 ? <p className={"muted-copy"}>{"No historical price snapshots yet."}</p> : <PriceHistoryChart points={priceHistoryPoints} />}
                        </section>
                    </article>
                ) : null}
                {propertyId === "" && portfolioSummaries.length > 0 ? (
                    <section className={"dashboard-list"}>
                        {portfolioSummaries.map((summary) => (
                            <article className={"dashboard-list__item"} key={summary.property.id}>
                                <div className={"listing-dense-row__headline"}>
                                    <div>
                                        <h3>{summary.property.label.trim() || summary.property.url || "Manual property"}</h3>
                                        <p className={"muted-copy"}>{summary.current_values.location ?? "Location unavailable"}</p>
                                    </div>
                                    <strong>{summary.decision.current_price === undefined ? "—" : formatCurrency(summary.decision.current_price, "EUR")}</strong>
                                </div>
                                <p>{summary.latest_change_summary}</p>
                                <p className={"muted-copy"}>{summary.property.metadata?.deal_thesis ?? summary.property.metadata?.acquisition_notes ?? "No notes yet."}</p>
                            </article>
                        ))}
                    </section>
                ) : null}
            </PageCard>
        </PageStack>
    );
};
