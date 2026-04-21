import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { LiveEventsPanel } from "@/features/backoffice/LiveEventsPanel";
import { AsyncContent } from "@/components/ui/AsyncContent";
import { PageCard } from "@/components/ui/PageCard";
import { formatDateTime } from "@/lib/format/date";
import { ingestSource } from "@/services/backoffice-runs/runs.service";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { listSources } from "@/services/backoffice-sources/sources.service";

/**
 * Hosts the backoffice sources route.
 *
 * @returns The placeholder source management screen.
 */
export const SourcesPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const sourcesQuery = useQuery({
        queryFn: listSources,
        queryKey: sourceKeys.list(),
    });
    const ingestMutation = useMutation({
        mutationFn: ({ force, sourceId }: { force: boolean; sourceId: string; }) => {
            return ingestSource(sourceId, force);
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: sourceKeys.list() });
            void queryClient.invalidateQueries({ queryKey: ["backoffice", "runs"] });
            void queryClient.invalidateQueries({ queryKey: ["listings"] });
            void queryClient.invalidateQueries({ queryKey: ["me", "notifications"] });
        },
    });
    const sources = sourcesQuery.data ?? [];

    return (
        <div className={"split-layout"}>
            <div className={"page-stack"}>
                <PageCard
                    action={<Link className={"button"} to={"/backoffice/sources/new"}>{"Register source"}</Link>}
                    description={"Source registration is intentionally literal in iteration 1: raw ids, raw config JSON, and explicit policy fields."}
                    title={"Sources"}
                >
                    <AsyncContent
                        emptyMessage={"No sources are configured yet."}
                        errorMessage={"Could not load sources."}
                        isEmpty={sourcesQuery.isSuccess && sources.length === 0}
                        isError={sourcesQuery.isError}
                        isLoading={sourcesQuery.isLoading}
                        loadingMessage={"Loading sources..."}
                    >
                        <div className={"item-list"}>
                            {sources.map((item) => {
                                return (
                                    <article className={"list-row"} key={item.id}>
                                        <div className={"list-row__main"}>
                                            <div>
                                                <h3 className={"list-row__title"}>
                                                    <Link to={`/backoffice/sources/${item.id}`}>{item.name}</Link>
                                                </h3>
                                                <p className={"list-row__meta"}>
                                                    {item.kind}{" · "}{item.endpoint_url}{" · "}{item.active ? "active" : "inactive"}
                                                </p>
                                            </div>
                                            <strong className={"list-row__price"}>{item.next_run_at === undefined ? "Manual or ad hoc" : `Next ${formatDateTime(item.next_run_at)}`}</strong>
                                        </div>
                                        <div className={"list-row__footer"}>
                                            <span>{"Last run "}{item.last_run_at === undefined ? "—" : formatDateTime(item.last_run_at)}</span>
                                            <div className={"action-group"}>
                                                <Link className={"button button--secondary"} to={`/backoffice/runs?source_id=${encodeURIComponent(item.id)}`}>{"Runs"}</Link>
                                                <button
                                                    className={"button button--secondary"}
                                                    disabled={ingestMutation.isPending}
                                                    onClick={() => {
                                                        ingestMutation.mutate({ force: false, sourceId: item.id });
                                                    }}
                                                    type={"button"}
                                                >
                                                    {"Ingest"}
                                                </button>
                                                <button
                                                    className={"button button--secondary"}
                                                    disabled={ingestMutation.isPending}
                                                    onClick={() => {
                                                        ingestMutation.mutate({ force: true, sourceId: item.id });
                                                    }}
                                                    type={"button"}
                                                >
                                                    {"Force ingest"}
                                                </button>
                                            </div>
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
