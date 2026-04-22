import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { LiveEventsPanel } from "@/features/backoffice/LiveEventsPanel";
import { AsyncContent } from "@/components/ui/AsyncContent";
import { PageCard } from "@/components/ui/PageCard";
import { formatDateTime } from "@/lib/format/date";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { deleteSource, listSources } from "@/services/backoffice-sources/sources.service";

export const SourcesPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const sourcesQuery = useQuery({
        queryFn: listSources,
        queryKey: sourceKeys.list(),
    });
    const deleteMutation = useMutation({
        mutationFn: deleteSource,
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: sourceKeys.list() });
        },
    });
    const sources = sourcesQuery.data ?? [];

    return (
        <div className={"split-layout"}>
            <div className={"page-stack"}>
                <PageCard
                    action={<Link className={"button"} to={"/sources/new"}>{"Create template"}</Link>}
                    description={"Templates are reusable selector sets. Properties can inherit them and override individual fields when needed."}
                    title={"Source Templates"}
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
                                                <h3 className={"list-row__title"}><Link to={`/sources/${item.id}`}>{item.name}</Link></h3>
                                                <p className={"list-row__meta"}>{item.id}</p>
                                            </div>
                                            <strong className={"list-row__price"}>{item.updated_at === undefined ? "New" : `Updated ${formatDateTime(item.updated_at)}`}</strong>
                                        </div>
                                        <div className={"list-row__footer"}>
                                            <span>{item.created_at === undefined ? "Created recently" : `Created ${formatDateTime(item.created_at)}`}</span>
                                            <div className={"action-group"}>
                                                <Link className={"button button--secondary"} to={`/sources/${item.id}`}>{"Edit"}</Link>
                                                <button className={"button button--secondary"} disabled={deleteMutation.isPending} onClick={() => { deleteMutation.mutate(item.id); }} type={"button"}>{"Delete"}</button>
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
