import { Link } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";
import { Bar } from "react-chartjs-2";

import { Button } from "@/components/ui/Button";
import { createBaseChartOptions, isChartJsdom, useChartTheme } from "@/components/ui/chartTheme";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format/date";
import { propertyKeys } from "@/services/properties/properties.keys";
import { listPropertySummaries } from "@/services/properties/properties.service";
import { buildPortfolioDashboardModel } from "@/features/properties/portfolioDashboard";

export const DashboardPage = (): JSX.Element => {
    const theme = useChartTheme();
    const summariesQuery = useQuery({
        queryFn: () => listPropertySummaries(),
        queryKey: propertyKeys.summaries(),
    });
    const model = buildPortfolioDashboardModel(summariesQuery.data ?? []);

    return (
        <PageStack>
            <PageCard
                action={<Button as={Link} to={"/properties"}>{"Open properties table"}</Button>}
                description={"Price-first portfolio view for movement, ranking, and stagnation in a single screen."}
                title={"Portfolio dashboard"}
            >
                {summariesQuery.isLoading ? <p className={"state-message state-message--loading"}>{"Loading dashboard..."}</p> : null}
                {summariesQuery.isError ? <p className={"state-message state-message--error"}>{"Could not load dashboard data."}</p> : null}
                {!summariesQuery.isLoading && !summariesQuery.isError ? (
                    <div className={"dashboard-grid"}>
                        <section className={"dashboard-grid dashboard-grid--summary"}>
                            <MetricCard label={"Properties"} value={`${model.totalProperties}`} />
                            <MetricCard label={"Average price"} value={formatMoney(model.averagePrice)} />
                            <MetricCard label={"Median price"} value={formatMoney(model.medianPrice)} />
                            <MetricCard label={"Recent updates"} value={`${model.recentUpdateCount}`} />
                        </section>

                        <section className={"dashboard-grid dashboard-grid--double"}>
                            <PageCard description={"Distribution of current prices across the tracked portfolio."} title={"Price distribution"}>
                                <DashboardBarChart
                                    labels={model.priceBucketCounts.map((bucket) => bucket.label)}
                                    theme={theme}
                                    values={model.priceBucketCounts.map((bucket) => bucket.count)}
                                    themeColor={theme.accent}
                                />
                            </PageCard>
                            <PageCard description={"Price increases, decreases, and stagnant properties for instant movement readout."} title={"Price movement"}>
                                <DashboardBarChart
                                    labels={["Decreases", "Stagnant", "Increases"]}
                                    theme={theme}
                                    values={[model.priceMovement.decreases, model.priceMovement.stagnant, model.priceMovement.increases]}
                                    themeColor={theme.series[2] ?? theme.accent}
                                />
                                <p className={"muted-copy"} style={{ marginTop: "0.75rem" }}>{`Net price movement: ${formatSignedMoney(model.priceMovement.netDelta)}`}</p>
                            </PageCard>
                        </section>

                        <section className={"dashboard-grid dashboard-grid--double"}>
                            <PageCard description={"Observable score weighted across price, €/sqm, rooms, bathrooms, and property age when available."} title={"Top opportunities"}>
                                <div className={"dashboard-list"}>
                                    {model.topOpportunities.map((candidate) => (
                                        <article className={"dashboard-list__item"} key={candidate.propertyId}>
                                            <div>
                                                <strong>{candidate.label}</strong>
                                                <p className={"muted-copy"}>{`Score ${candidate.score} · ${formatMoney(candidate.price ?? 0)}`}</p>
                                            </div>
                                            <p className={"muted-copy"}>
                                                {`Price ${candidate.breakdown.price.toFixed(2)} · €/sqm ${candidate.breakdown.pricePerSquareMeter.toFixed(2)} · rooms ${candidate.breakdown.rooms.toFixed(2)} · baths ${candidate.breakdown.bathrooms.toFixed(2)} · age ${candidate.breakdown.propertyAge.toFixed(2)}`}
                                            </p>
                                        </article>
                                    ))}
                                    {model.topOpportunities.length === 0 ? <p className={"muted-copy"}>{"Not enough priced properties to rank opportunities yet."}</p> : null}
                                </div>
                            </PageCard>
                            <PageCard description={"Most recent price changes, with significant moves immediately highlighted."} title={"Change tracking"}>
                                <div className={"dashboard-list"}>
                                    {model.priceChanges.slice(0, 8).map((change) => (
                                        <article className={"dashboard-list__item"} key={`${change.propertyId}-${change.observedAt}`}>
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                                                <strong>{change.label}</strong>
                                                <StatusBadge tone={change.deltaAbsolute < 0 ? "success" : "warning"} value={change.deltaAbsolute < 0 ? "price down" : "price up"} />
                                            </div>
                                            <p className={"muted-copy"}>{`${formatSignedMoney(change.deltaAbsolute)}${change.deltaPercent === undefined ? "" : ` · ${formatSignedPercent(change.deltaPercent)}`} · ${formatDateTime(change.observedAt)}`}</p>
                                        </article>
                                    ))}
                                    {model.priceChanges.length === 0 ? <p className={"muted-copy"}>{"No price changes have been recorded yet."}</p> : null}
                                </div>
                            </PageCard>
                        </section>

                        <section className={"dashboard-grid dashboard-grid--double"}>
                            <PageCard description={"Activity indicators separate changed inventory from static inventory."} title={"Market dynamics"}>
                                <DashboardBarChart
                                    labels={["Updated", "Stagnant"]}
                                    theme={theme}
                                    values={[model.recentUpdateCount, model.stagnantCount]}
                                    themeColor={theme.series[1] ?? theme.accent}
                                />
                            </PageCard>
                            <PageCard description={"Fast answers for what changed, where the best deals are, and what still needs movement."} title={"Portfolio state"}>
                                <div className={"dashboard-list"}>
                                    <article className={"dashboard-list__item"}>
                                        <strong>{"What changed?"}</strong>
                                        <p className={"muted-copy"}>{`${model.recentUpdateCount} properties changed price recently.`}</p>
                                    </article>
                                    <article className={"dashboard-list__item"}>
                                        <strong>{"Best deals?"}</strong>
                                        <p className={"muted-copy"}>{model.topOpportunities[0] === undefined ? "No ranked candidate yet." : `${model.topOpportunities[0].label} currently leads with score ${model.topOpportunities[0].score}.`}</p>
                                    </article>
                                    <article className={"dashboard-list__item"}>
                                        <strong>{"What is stagnant?"}</strong>
                                        <p className={"muted-copy"}>{`${model.stagnantCount} properties have no detected price movement.`}</p>
                                    </article>
                                </div>
                            </PageCard>
                        </section>
                    </div>
                ) : null}
            </PageCard>
        </PageStack>
    );
};

const DashboardBarChart = ({
    labels,
    theme,
    themeColor,
    values,
}: {
    readonly labels: readonly string[];
    readonly theme: ReturnType<typeof useChartTheme>;
    readonly themeColor: string;
    readonly values: readonly number[];
}): JSX.Element => {
    if (isChartJsdom()) {
        return <div className={"enterprise-chart"} />;
    }

    return (
        <div className={"enterprise-chart"}>
            <Bar
                data={{
                    datasets: [{
                        backgroundColor: `${themeColor}cc`,
                        borderColor: themeColor,
                        borderRadius: 8,
                        data: values,
                    }],
                    labels: [...labels],
                }}
                options={createBaseChartOptions<"bar">(theme, { hideLegend: true })}
            />
        </div>
    );
};

const MetricCard = ({ label, value }: { readonly label: string; readonly value: string; }): JSX.Element => (
    <div className={"enterprise-metric-card"}>
        <span className={"enterprise-metric-card__label"}>{label}</span>
        <strong className={"enterprise-metric-card__value"}>{value}</strong>
    </div>
);

const formatMoney = (value: number): string => new Intl.NumberFormat("en", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency",
}).format(value);

const formatSignedMoney = (value: number): string => `${value >= 0 ? "+" : "−"}${formatMoney(Math.abs(value))}`;

const formatSignedPercent = (value: number): string => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
