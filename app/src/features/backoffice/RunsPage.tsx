import { useEffect, useState } from "react";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { LiveEventsPanel } from "@/features/backoffice/LiveEventsPanel";
import { AsyncContent } from "@/components/ui/AsyncContent";
import { PageCard } from "@/components/ui/PageCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format/date";
import { readNumberParam, readStringParam, writeParam } from "@/lib/routing/searchParams";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { listRuns } from "@/services/backoffice-runs/runs.service";
import type { Run, RunFilters } from "@/services/backoffice-runs/runs.types";

/**
 * Hosts the ingestion run list route.
 *
 * @returns The placeholder run list screen.
 */
export const RunsPage = (): JSX.Element => {
    const [searchParams, setSearchParams] = useSearchParams();
    const filters: RunFilters = {
        limit: readNumberParam(searchParams, "limit", 25),
        source_id: readStringParam(searchParams, "source_id"),
    };
    const [draftSourceId, setDraftSourceId] = useState(filters.source_id);
    const [draftLimit, setDraftLimit] = useState(`${filters.limit}`);
    const runsQuery = useQuery({
        placeholderData: keepPreviousData,
        queryFn: () => {
            return listRuns(filters);
        },
        queryKey: runKeys.list(filters),
    });

    useEffect(() => {
        setDraftSourceId(filters.source_id);
        setDraftLimit(`${filters.limit}`);
    }, [filters.limit, filters.source_id]);

    return (
        <div className={"split-layout"}>
            <div className={"page-stack"}>
                <PageCard description={"Runs can currently be filtered by source id and limit only."} title={"Runs"}>
                    <form
                        className={"form-grid form-grid--inline"}
                        onSubmit={(event) => {
                            event.preventDefault();
                            const nextParams = new URLSearchParams(searchParams);
                            writeParam(nextParams, "source_id", draftSourceId);
                            writeParam(nextParams, "limit", draftLimit);
                            setSearchParams(nextParams);
                        }}
                    >
                        <label className={"field"}>
                            <span className={"field__label"}>{"Source id"}</span>
                            <input className={"field__control"} onChange={(event) => { setDraftSourceId(event.target.value); }} value={draftSourceId} />
                        </label>

                        <label className={"field"}>
                            <span className={"field__label"}>{"Limit"}</span>
                            <input className={"field__control"} min={1} onChange={(event) => { setDraftLimit(event.target.value); }} step={1} type={"number"} value={draftLimit} />
                        </label>

                        <div className={"field field--actions"}>
                            <button className={"button"} type={"submit"}>{"Apply"}</button>
                        </div>
                    </form>
                </PageCard>

                <PageCard description={"Manual ingests complete synchronously, so the resulting run record is immediately available here."} title={"Recent Runs"}>
                    <AsyncContent
                        emptyMessage={"No runs matched the current filters."}
                        errorMessage={"Could not load runs."}
                        isEmpty={runsQuery.isSuccess && runsQuery.data.items.length === 0}
                        isError={runsQuery.isError}
                        isLoading={runsQuery.isLoading}
                        loadingMessage={"Loading runs..."}
                    >
                        <div className={"item-list"}>
                            {(runsQuery.data?.items ?? []).map((item) => {
                                return (
                                    <article className={"list-row"} key={item.id}>
                                        <div className={"list-row__main"}>
                                            <div>
                                                <h3 className={"list-row__title"}>
                                                    <Link to={`/backoffice/runs/${item.id}`}>{item.id}</Link>
                                                </h3>
                                                <p className={"list-row__meta"}>{item.source_id}{" · "}{item.trigger_kind}{" · started "}{formatDateTime(item.started_at)}</p>
                                            </div>
                                            <StatusBadge tone={statusTone(item)} value={item.status} />
                                        </div>
                                        <div className={"list-row__footer"}>
                                            <span>{"Items "}{item.item_count}</span>
                                            <span>{"Attempts "}{item.attempt_count}</span>
                                            <span>{item.finished_at === undefined ? "Still running" : `Finished ${formatDateTime(item.finished_at)}`}</span>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </AsyncContent>
                </PageCard>
            </div>

            <LiveEventsPanel />
        </div>
    );
};

const statusTone = (run: Run): "danger" | "neutral" | "success" | "warning" => {
    switch (run.status) {
        case "completed":
            return "success";
        case "failed":
            return "danger";
        case "running":
            return "warning";
        default:
            return "neutral";
    }
};
