import { useMemo, useState } from "react";

import { useQuery, useQueries } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/date";
import { propertyKeys } from "@/services/properties/properties.keys";
import { listPropertySummaries } from "@/services/properties/properties.service";
import { tagKeys } from "@/services/tags/tags.keys";
import { listPropertyTags } from "@/services/tags/tags.service";
import {
    MAX_COMPARISON_PROPERTIES,
    MIN_COMPARISON_PROPERTIES,
    buildComparablePropertyCard,
    parseComparisonIds,
    readSavedComparisons,
    stringifyComparisonIds,
    writeSavedComparisons,
} from "@/features/properties/propertyCompare";

const comparisonTone = (status: string): "danger" | "neutral" | "success" | "warning" => {
    switch (status) {
        case "active":
            return "success";
        case "degraded":
            return "warning";
        case "inactive":
            return "neutral";
        default:
            return "danger";
    }
};

export const PropertyComparePage = (): JSX.Element => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [comparisonName, setComparisonName] = useState("");
    const [savedComparisons, setSavedComparisons] = useState(() => readSavedComparisons());
    const selectedIds = useMemo(() => parseComparisonIds(searchParams.get("ids")), [searchParams]);
    const summariesQuery = useQuery({
        queryFn: () => listPropertySummaries(),
        queryKey: propertyKeys.summaries(),
    });
    const tagQueries = useQueries({
        queries: selectedIds.map((propertyId) => ({
            enabled: propertyId !== "",
            queryFn: () => listPropertyTags(propertyId),
            queryKey: tagKeys.propertyTags(propertyId),
        })),
    });
    const cards = useMemo(() => {
        const summaryById = new Map((summariesQuery.data ?? []).map((summary) => [summary.property.id, summary]));
        return selectedIds
            .map((propertyId, index) => {
                const summary = summaryById.get(propertyId);
                if (summary === undefined) {
                    return null;
                }

                return buildComparablePropertyCard(summary, tagQueries[index]?.data ?? []);
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
    }, [selectedIds, summariesQuery.data, tagQueries]);
    return (
        <PageStack>
            <PageCard
                action={(
                    <div className={"action-group"}>
                        <Button as={Link} to={"/properties"} variant={"secondary"}>{"Back to properties"}</Button>
                    </div>
                )}
                description={"Compare the latest attributes, tags, pricing, and notes side-by-side."}
                title={"Property comparison"}
            >
                {selectedIds.length < MIN_COMPARISON_PROPERTIES || selectedIds.length > MAX_COMPARISON_PROPERTIES ? (
                    <EmptyState
                        message={`Select between ${MIN_COMPARISON_PROPERTIES} and ${MAX_COMPARISON_PROPERTIES} properties to compare from the properties or bookmarks pages.`}
                    />
                ) : null}
                {summariesQuery.isError ? <ErrorBanner>{"Could not load the comparison."}</ErrorBanner> : null}
                {selectedIds.length >= MIN_COMPARISON_PROPERTIES && cards.length > 0 ? (
                    <div className={"dashboard-grid"}>
                        <div className={"toolbar"}>
                            <span className={"muted-copy"}>{`${cards.length} properties selected`}</span>
                            <Field label={"Save this comparison"}>
                                <div className={"action-group"}>
                                    <Input
                                        onChange={(event) => { setComparisonName(event.target.value); }}
                                        placeholder={"e.g. Bilbao shortlist"}
                                        value={comparisonName}
                                    />
                                    <Button
                                        disabled={comparisonName.trim() === ""}
                                        onClick={() => {
                                            const nextItems = [{
                                                createdAt: new Date().toISOString(),
                                                id: `cmp_${Date.now()}`,
                                                name: comparisonName.trim(),
                                                propertyIds: selectedIds,
                                            }, ...savedComparisons].slice(0, 8);
                                            writeSavedComparisons(nextItems);
                                            setSavedComparisons(nextItems);
                                            setComparisonName("");
                                        }}
                                        variant={"secondary"}
                                    >
                                        {"Save"}
                                    </Button>
                                </div>
                            </Field>
                        </div>
                        <div className={"compare-grid"} style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}>
                            {cards.map((card) => (
                                <article className={"compare-card"} key={card.id}>
                                    <div className={"listing-dense-row__headline"}>
                                        <div>
                                            <h3>{card.label}</h3>
                                            <p className={"muted-copy"}>{card.location}</p>
                                        </div>
                                        <StatusBadge tone={comparisonTone(card.status)} value={card.status} />
                                    </div>
                                    <dl className={"compare-card__metrics"}>
                                        <div>
                                            <dt>{"Price"}</dt>
                                            <dd>{card.price === undefined ? "—" : formatCurrency(card.price, "EUR")}</dd>
                                        </div>
                                        <div>
                                            <dt>{"€/sqm"}</dt>
                                            <dd>{card.pricePerSquareMeter === undefined ? "—" : formatCurrency(card.pricePerSquareMeter, "EUR")}</dd>
                                        </div>
                                        <div>
                                            <dt>{"Rooms"}</dt>
                                            <dd>{card.rooms}</dd>
                                        </div>
                                        <div>
                                            <dt>{"Type"}</dt>
                                            <dd>{card.propertyType}</dd>
                                        </div>
                                        <div>
                                            <dt>{"Stage"}</dt>
                                            <dd>{card.businessStage}</dd>
                                        </div>
                                        <div>
                                            <dt>{"Tags"}</dt>
                                            <dd>{card.tags.length > 0 ? card.tags.join(", ") : "—"}</dd>
                                        </div>
                                        <div>
                                            <dt>{"Latest change"}</dt>
                                            <dd>{card.latestChange}</dd>
                                        </div>
                                        <div>
                                            <dt>{"Notes"}</dt>
                                            <dd>{card.acquisitionNotes}</dd>
                                        </div>
                                        <div>
                                            <dt>{"Decision"}</dt>
                                            <dd>{card.dealThesis}</dd>
                                        </div>
                                    </dl>
                                    <div className={"action-group"}>
                                        <Button as={Link} to={`/properties/${card.id}`} variant={"secondary"}>{"Open property"}</Button>
                                        {card.url.trim() !== "" ? <a className={"text-link"} href={card.url} rel={"noreferrer"} target={"_blank"}>{"Open source"}</a> : null}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                ) : null}
            </PageCard>
            <PageCard description={"Restore frequently used comparisons without reselecting rows."} title={"Saved comparisons"}>
                {savedComparisons.length === 0 ? <p className={"muted-copy"}>{"No comparisons saved yet."}</p> : (
                    <div className={"dashboard-list"}>
                        {savedComparisons.map((item) => (
                            <article className={"dashboard-list__item"} key={item.id}>
                                <strong>{item.name}</strong>
                                <span className={"muted-copy"}>{`${item.propertyIds.length} properties · saved ${formatDateTime(item.createdAt)}`}</span>
                                <div className={"action-group"}>
                                    <Button
                                        onClick={() => {
                                            void navigate(`/properties/compare?ids=${encodeURIComponent(stringifyComparisonIds(item.propertyIds))}`);
                                        }}
                                        variant={"secondary"}
                                    >
                                        {"Open"}
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            const nextItems = savedComparisons.filter((candidate) => candidate.id !== item.id);
                                            writeSavedComparisons(nextItems);
                                            setSavedComparisons(nextItems);
                                        }}
                                        variant={"ghost"}
                                    >
                                        {"Remove"}
                                    </Button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </PageCard>
        </PageStack>
    );
};
