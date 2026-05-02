import { useState } from "react";

import { Link } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";
import type { ActiveElement, ChartDataset, ChartOptions } from "chart.js";
import { Bar, Scatter } from "react-chartjs-2";

import { Button } from "@/components/ui/Button";
import { createBaseChartOptions, isChartJsdom, useChartTheme } from "@/components/ui/chartTheme";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { formatCurrency } from "@/lib/format/currency";
import { buildPortfolioDashboardModel, type OpportunityCandidate } from "@/features/properties/portfolioDashboard";
import { propertyKeys } from "@/services/properties/properties.keys";
import { listPropertySummaries } from "@/services/properties/properties.service";

export const DashboardPage = (): JSX.Element => {
    const theme = useChartTheme();
    const [hoveredOpportunityId, setHoveredOpportunityId] = useState<string | null>(null);
    const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
    const summariesQuery = useQuery({
        queryFn: () => listPropertySummaries(),
        queryKey: propertyKeys.summaries(),
    });
    const model = buildPortfolioDashboardModel(summariesQuery.data ?? []);
    const activeOpportunity = model.topOpportunities.find((candidate) => candidate.propertyId === (selectedOpportunityId ?? hoveredOpportunityId))
        ?? model.topOpportunities[0];
    const stagnantShare = formatShare(model.stagnantCount, model.totalProperties);

    return (
        <PageStack>
            <PageCard
                action={(
                    <div className={"action-group"}>
                        <Button as={Link} to={"/properties/new"}>{"Add Property"}</Button>
                        <Button as={Link} to={"/properties"} variant={"secondary"}>{"Open properties table"}</Button>
                    </div>
                )}
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
                                <div className={"dashboard-chip-strip"}>
                                    <DashboardInsightChip label={"Down"} tone={"success"} value={`${model.priceMovement.decreases}`} />
                                    <DashboardInsightChip label={"Stagnant"} value={`${model.priceMovement.stagnant}`} />
                                    <DashboardInsightChip label={"Up"} tone={"warning"} value={`${model.priceMovement.increases}`} />
                                    <DashboardInsightChip label={"Net"} value={formatSignedMoney(model.priceMovement.netDelta)} />
                                </div>
                            </PageCard>
                        </section>

                        <PageCard description={"Scatter plot compares score against current asking price; hover or select a point to inspect the weighted breakdown."} title={"Top opportunities"}>
                            {model.topOpportunities.length === 0 ? <p className={"muted-copy"}>{"Not enough priced properties to rank opportunities yet."}</p> : (
                                <div className={"dashboard-opportunity-panel"}>
                                    <DashboardOpportunityScatter
                                        activeId={activeOpportunity?.propertyId ?? null}
                                        opportunities={model.topOpportunities}
                                        onHover={setHoveredOpportunityId}
                                        onSelect={(propertyId) => {
                                            setSelectedOpportunityId((current) => current === propertyId ? null : propertyId);
                                        }}
                                        theme={theme}
                                    />
                                    {activeOpportunity !== undefined ? <DashboardOpportunityDetail candidate={activeOpportunity} /> : null}
                                </div>
                            )}
                        </PageCard>

                        <section className={"dashboard-grid dashboard-grid--double"}>
                            <PageCard description={"Activity indicators separate changed inventory from static inventory."} title={"Market dynamics"}>
                                <DashboardBarChart
                                    labels={["Updated", "Stagnant"]}
                                    theme={theme}
                                    values={[model.recentUpdateCount, model.stagnantCount]}
                                    themeColor={theme.series[1] ?? theme.accent}
                                />
                                <div className={"dashboard-chip-strip"}>
                                    <DashboardInsightChip label={"Updated"} tone={model.recentUpdateCount > 0 ? "success" : "neutral"} value={`${model.recentUpdateCount}`} />
                                    <DashboardInsightChip label={"Static share"} tone={stagnantShare > 60 ? "warning" : "neutral"} value={`${stagnantShare}%`} />
                                </div>
                            </PageCard>
                            <PageCard description={"Fast answers for what changed, where the best deals are, and what still needs movement."} title={"Portfolio state"}>
                                <div className={"dashboard-state-grid"}>
                                    <DashboardStateTile
                                        context={model.topOpportunities[0] === undefined ? "Not enough priced properties to rank yet." : `${formatMoney(model.topOpportunities[0].price ?? 0)} · ${formatDashboardPropertyLabel(model.topOpportunities[0].label)}`}
                                        label={"Lead opportunity"}
                                        value={model.topOpportunities[0] === undefined ? "Waiting for score" : `Score ${model.topOpportunities[0].score}`}
                                    />
                                    <DashboardStateTile
                                        context={`Net ${formatSignedMoney(model.priceMovement.netDelta)} across the latest recorded price changes.`}
                                        label={"Movement window"}
                                        value={model.recentUpdateCount === 0 ? "Quiet" : `${model.recentUpdateCount} changed`}
                                    />
                                    <DashboardStateTile
                                        context={model.totalProperties === 0 ? "No properties tracked yet." : `${stagnantShare}% of tracked properties have no detected price movement.`}
                                        label={"Stagnant stock"}
                                        value={`${model.stagnantCount}`}
                                    />
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
    className = "dashboard-chart",
    labels,
    theme,
    themeColor,
    values,
}: {
    readonly className?: string;
    readonly labels: readonly string[];
    readonly theme: ReturnType<typeof useChartTheme>;
    readonly themeColor: string;
    readonly values: readonly number[];
}): JSX.Element => {
    if (isChartJsdom()) {
        return <div className={`enterprise-chart ${className}`.trim()} />;
    }

    return (
        <div className={`enterprise-chart ${className}`.trim()}>
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

interface DashboardOpportunityPoint {
    readonly deltaAbsolute?: number;
    readonly deltaPercent?: number;
    readonly label: string;
    readonly pricePerSquareMeter?: number;
    readonly propertyId: string;
    readonly x: number;
    readonly y: number;
}

const DashboardOpportunityScatter = ({
    activeId,
    onHover,
    onSelect,
    opportunities,
    theme,
}: {
    readonly activeId: string | null;
    readonly onHover: (propertyId: string | null) => void;
    readonly onSelect: (propertyId: string | null) => void;
    readonly opportunities: readonly OpportunityCandidate[];
    readonly theme: ReturnType<typeof useChartTheme>;
}): JSX.Element => {
    if (isChartJsdom()) {
        return <div aria-label={"Top opportunities scatter chart"} className={"enterprise-chart dashboard-chart"} />;
    }

    const datasets = buildOpportunityScatterDatasets(opportunities, activeId, theme);
    const showLegend = datasets.length > 1;
    const base = createBaseChartOptions<"scatter">(theme, { hideLegend: !showLegend });
    const options: ChartOptions<"scatter"> = {
        ...base,
        interaction: {
            intersect: false,
            mode: "nearest",
        },
        onClick: (_event, elements, chart) => {
            onSelect(resolveOpportunityId(elements, chart.data as unknown as { readonly datasets: { readonly data: DashboardOpportunityPoint[]; }[]; }));
        },
        onHover: (_event, elements, chart) => {
            onHover(resolveOpportunityId(elements, chart.data as unknown as { readonly datasets: { readonly data: DashboardOpportunityPoint[]; }[]; }));
        },
        plugins: {
            ...base.plugins,
            tooltip: {
                ...base.plugins?.tooltip,
                callbacks: {
                    label: (context) => {
                        const point = context.raw as DashboardOpportunityPoint;
                        return [
                            `Score ${point.y} · ${formatMoney(point.x)}`,
                            point.pricePerSquareMeter === undefined ? "€/sqm unavailable" : `${formatMoney(point.pricePerSquareMeter)}/sqm`,
                            point.deltaAbsolute === undefined || point.deltaAbsolute === 0
                                ? "No recent price change"
                                : `Last move ${formatSignedMoney(point.deltaAbsolute)}${point.deltaPercent === undefined ? "" : ` · ${formatSignedPercent(point.deltaPercent)}`}`,
                        ];
                    },
                    title: (items) => {
                        const point = items[0]?.raw as DashboardOpportunityPoint | undefined;
                        return point?.label ?? "";
                    },
                },
            },
        },
        scales: {
            ...base.scales,
            x: {
                ...base.scales?.x,
                ticks: {
                    ...base.scales?.x?.ticks,
                    callback: (value) => formatCompactMoney(Number(value)),
                },
                title: {
                    color: theme.muted,
                    display: true,
                    font: {
                        size: 11,
                        weight: 600,
                    },
                    text: "Current price",
                },
            },
            y: {
                ...base.scales?.y,
                max: 100,
                min: 0,
                title: {
                    color: theme.muted,
                    display: true,
                    font: {
                        size: 11,
                        weight: 600,
                    },
                    text: "Opportunity score",
                },
            },
        },
    };

    return (
        <div className={"enterprise-chart dashboard-chart"}>
            <Scatter data={{ datasets }} options={options} />
        </div>
    );
};

const DashboardOpportunityDetail = ({ candidate }: { readonly candidate: OpportunityCandidate; }): JSX.Element => (
    <aside className={"dashboard-opportunity-insights"}>
        <div className={"dashboard-opportunity-summary"}>
            <div className={"dashboard-opportunity-heading"}>
                <p className={"dashboard-opportunity-eyebrow"}>{"Selected property"}</p>
                <strong className={"dashboard-opportunity-title"} title={candidate.label}>{formatDashboardPropertyLabel(candidate.label)}</strong>
            </div>
            <div className={"dashboard-opportunity-actions"}>
                <span className={"dashboard-score-pill"}>{`Score ${candidate.score}`}</span>
                <Button as={Link} size={"small"} to={`/properties/${candidate.propertyId}`} variant={"secondary"}>{"Open"}</Button>
            </div>
        </div>

        <dl className={"dashboard-opportunity-meta"}>
            <DashboardMetaItem label={"Price"} value={candidate.price === undefined ? "—" : formatMoney(candidate.price)} />
            <DashboardMetaItem label={"€/sqm"} value={candidate.pricePerSquareMeter === undefined ? "—" : `${formatMoney(candidate.pricePerSquareMeter)}/sqm`} />
            <DashboardMetaItem label={"Layout"} value={formatOpportunityLayout(candidate)} />
            <DashboardMetaItem label={"Vintage"} value={candidate.propertyAge === undefined ? "—" : `${formatQuantity(candidate.propertyAge)}y`} />
            <DashboardMetaItem label={"Last move"} value={formatOpportunityMovement(candidate)} wide />
        </dl>

        <div className={"dashboard-breakdown"}>
            <DashboardBreakdownRow label={"Price"} value={candidate.breakdown.price} />
            <DashboardBreakdownRow label={"€/sqm"} value={candidate.breakdown.pricePerSquareMeter} />
            <DashboardBreakdownRow label={"Rooms"} value={candidate.breakdown.rooms} />
            <DashboardBreakdownRow label={"Baths"} value={candidate.breakdown.bathrooms} />
            <DashboardBreakdownRow label={"Age"} value={candidate.breakdown.propertyAge} />
        </div>

    </aside>
);

const DashboardMetaItem = ({
    label,
    value,
    wide = false,
}: {
    readonly label: string;
    readonly value: string;
    readonly wide?: boolean;
}): JSX.Element => (
    <div className={`dashboard-opportunity-meta__item${wide ? " dashboard-opportunity-meta__item--wide" : ""}`}>
        <dt className={"dashboard-opportunity-meta__label"}>{label}</dt>
        <dd className={"dashboard-opportunity-meta__value"} title={value}>{value}</dd>
    </div>
);

const DashboardBreakdownRow = ({ label, value }: { readonly label: string; readonly value: number; }): JSX.Element => (
    <div className={"dashboard-breakdown-row"}>
        <span className={"dashboard-breakdown-row__label"}>{label}</span>
        <span className={"dashboard-breakdown-track"}>
            <span className={"dashboard-breakdown-fill"} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
        </span>
        <strong className={"dashboard-breakdown-row__value"}>{Math.round(value * 100)}</strong>
    </div>
);

const DashboardInsightChip = ({
    label,
    tone = "neutral",
    value,
}: {
    readonly label: string;
    readonly tone?: "neutral" | "success" | "warning";
    readonly value: string;
}): JSX.Element => (
    <div className={`dashboard-chip dashboard-chip--${tone}`}>
        <span className={"dashboard-chip__label"}>{label}</span>
        <strong className={"dashboard-chip__value"}>{value}</strong>
    </div>
);

const DashboardStateTile = ({
    context,
    label,
    value,
}: {
    readonly context: string;
    readonly label: string;
    readonly value: string;
}): JSX.Element => (
    <article className={"dashboard-state-tile"}>
        <span className={"dashboard-state-tile__label"}>{label}</span>
        <strong className={"dashboard-state-tile__value"}>{value}</strong>
        <p className={"dashboard-state-tile__context"} title={context}>{context}</p>
    </article>
);

const buildOpportunityScatterDatasets = (
    opportunities: readonly OpportunityCandidate[],
    activeId: string | null,
    theme: ReturnType<typeof useChartTheme>,
): ChartDataset<"scatter", DashboardOpportunityPoint[]>[] => {
    const groups = [
        {
            color: theme.series[2] ?? theme.accent,
            items: opportunities.filter((candidate) => (candidate.deltaAbsolute ?? 0) < 0),
            label: "Price down",
        },
        {
            color: theme.series[1] ?? theme.accent,
            items: opportunities.filter((candidate) => (candidate.deltaAbsolute ?? 0) === 0),
            label: "Stable",
        },
        {
            color: theme.series[3] ?? theme.accent,
            items: opportunities.filter((candidate) => (candidate.deltaAbsolute ?? 0) > 0),
            label: "Price up",
        },
    ].filter((group) => group.items.length > 0);

    return groups.map((group) => ({
        backgroundColor: group.color,
        borderColor: group.color,
        data: group.items.map((candidate) => ({
            deltaAbsolute: candidate.deltaAbsolute,
            deltaPercent: candidate.deltaPercent,
            label: candidate.label,
            pricePerSquareMeter: candidate.pricePerSquareMeter,
            propertyId: candidate.propertyId,
            x: candidate.price ?? 0,
            y: candidate.score,
        })),
        label: group.label,
        pointBackgroundColor: group.items.map((candidate) => candidate.propertyId === activeId ? group.color : theme.surface),
        pointBorderColor: group.color,
        pointBorderWidth: group.items.map((candidate) => candidate.propertyId === activeId ? 2 : 1.5),
        pointHoverBackgroundColor: group.color,
        pointHoverRadius: 7,
        pointRadius: group.items.map((candidate) => candidate.propertyId === activeId ? 6 : 4),
    }));
};

const resolveOpportunityId = (
    elements: readonly ActiveElement[],
    chartData: { readonly datasets: { readonly data: DashboardOpportunityPoint[]; }[]; },
): string | null => {
    const first = elements[0];
    if (first === undefined) {
        return null;
    }

    return chartData.datasets[first.datasetIndex]?.data[first.index]?.propertyId ?? null;
};

const MetricCard = ({ label, value }: { readonly label: string; readonly value: string; }): JSX.Element => (
    <div className={"enterprise-metric-card"}>
        <span className={"enterprise-metric-card__label"}>{label}</span>
        <strong className={"enterprise-metric-card__value"}>{value}</strong>
    </div>
);

const compactMoneyFormatter = new Intl.NumberFormat(undefined, {
    currency: "EUR",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
});

const formatMoney = (value: number): string => formatCurrency(value, "EUR");

const formatCompactMoney = (value: number): string => Number.isFinite(value) ? compactMoneyFormatter.format(value) : "—";

const formatSignedMoney = (value: number): string => `${value >= 0 ? "+" : "−"}${formatMoney(Math.abs(value))}`;

const formatSignedPercent = (value: number): string => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;

const formatOpportunityLayout = (candidate: OpportunityCandidate): string => {
    const rooms = candidate.rooms === undefined ? "—" : `${formatQuantity(candidate.rooms)}r`;
    const bathrooms = candidate.bathrooms === undefined ? "—" : `${formatQuantity(candidate.bathrooms)}b`;
    return `${rooms} · ${bathrooms}`;
};

const formatOpportunityMovement = (candidate: OpportunityCandidate): string => {
    if (candidate.deltaAbsolute === undefined || candidate.deltaAbsolute === 0) {
        return "No recorded price delta yet.";
    }

    return `Last move ${formatSignedMoney(candidate.deltaAbsolute)}${candidate.deltaPercent === undefined ? "" : ` · ${formatSignedPercent(candidate.deltaPercent)}`}`;
};

const formatDashboardPropertyLabel = (label: string): string => {
    try {
        const url = new URL(label);
        const segments = url.pathname.split("/").filter((segment) => segment !== "");
        const location = segments.at(-3) ?? segments.at(-2) ?? "listing";
        const listingId = segments.at(-1) ?? location;
        return `${url.hostname} · ${location.replace(/-/g, " ")} · ${listingId}`;
    } catch {
        return label;
    }
};

const formatQuantity = (value: number): string => Number.isInteger(value) ? `${value}` : value.toFixed(1);

const formatShare = (value: number, total: number): number => total <= 0 ? 0 : Math.round((value / total) * 100);
