import { useEffect, useState } from "react";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { LiveEventsPanel } from "@/features/backoffice/LiveEventsPanel";
import { AsyncContent } from "@/components/ui/AsyncContent";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { ItemList } from "@/components/ui/ItemList";
import { ListRow, ListRowFooter, ListRowMain } from "@/components/ui/ListRow";
import { PageCard } from "@/components/ui/PageCard";
import { SplitLayout } from "@/components/ui/SplitLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format/date";
import { readNumberParam, readStringParam, writeParam } from "@/lib/routing/searchParams";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { listRuns } from "@/services/backoffice-runs/runs.service";
import type { Run, RunFilters } from "@/services/backoffice-runs/runs.types";

export const RunsPage = (): JSX.Element => {
    const [searchParams, setSearchParams] = useSearchParams();
    const filters: RunFilters = {
        limit: readNumberParam(searchParams, "limit", 25),
        property_id: readStringParam(searchParams, "property_id"),
    };
    const [draftPropertyId, setDraftPropertyId] = useState(filters.property_id);
    const [draftLimit, setDraftLimit] = useState(`${filters.limit}`);
    const runsQuery = useQuery({
        placeholderData: keepPreviousData,
        queryFn: () => listRuns(filters),
        queryKey: runKeys.list(filters),
    });

    useEffect(() => {
        setDraftPropertyId(filters.property_id);
        setDraftLimit(`${filters.limit}`);
    }, [filters.limit, filters.property_id]);

    return (
        <SplitLayout aside={<LiveEventsPanel />}>
            <PageCard description={"Runs can be filtered by property id and limit."} title={"Runs"}>
                <FormGrid
                    variant={"inline"}
                    onSubmit={(event) => {
                        event.preventDefault();
                        const nextParams = new URLSearchParams(searchParams);
                        writeParam(nextParams, "property_id", draftPropertyId);
                        writeParam(nextParams, "limit", draftLimit);
                        setSearchParams(nextParams);
                    }}
                >
                    <Field label={"Property id"}>
                        <Input onChange={(event) => { setDraftPropertyId(event.target.value); }} value={draftPropertyId} />
                    </Field>
                    <Field label={"Limit"}>
                        <Input min={1} onChange={(event) => { setDraftLimit(event.target.value); }} step={1} type={"number"} value={draftLimit} />
                    </Field>
                    <Field as={"div"} variant={"actions"}>
                        <Button type={"submit"}>{"Apply"}</Button>
                    </Field>
                </FormGrid>
            </PageCard>

            <PageCard description={"Every run is a point-in-time snapshot of one property fetch and extraction attempt."} title={"Recent Runs"}>
                <AsyncContent
                    emptyMessage={"No runs matched the current filters."}
                    errorMessage={"Could not load runs."}
                    isEmpty={runsQuery.isSuccess && runsQuery.data.items.length === 0}
                    isError={runsQuery.isError}
                    isLoading={runsQuery.isLoading}
                    loadingMessage={"Loading runs..."}
                >
                    <ItemList>
                        {(runsQuery.data?.items ?? []).map((item) => {
                            return (
                                <ListRow key={item.id}>
                                    <ListRowMain>
                                        <div>
                                            <h3 className={"list-row__title"}><Link to={`/runs/${item.id}`}>{item.id}</Link></h3>
                                            <p className={"list-row__meta"}>{item.property_id}{" · observed "}{formatDateTime(item.observed_at)}</p>
                                        </div>
                                        <StatusBadge tone={statusTone(item)} value={item.is_valid ? "valid" : "invalid"} />
                                    </ListRowMain>
                                    <ListRowFooter>
                                        <span>{`Fields ${Object.keys(item.values).length}`}</span>
                                        <span>{item.error_message === undefined || item.error_message === "" ? "Completed" : item.error_message}</span>
                                    </ListRowFooter>
                                </ListRow>
                            );
                        })}
                    </ItemList>
                </AsyncContent>
            </PageCard>
        </SplitLayout>
    );
};

const statusTone = (run: Run): "danger" | "success" | "warning" => {
    if (!run.is_valid && run.error_message !== undefined && run.error_message !== "") {
        return "danger";
    }

    return run.is_valid ? "success" : "warning";
};
