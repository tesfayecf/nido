import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { LiveEventsPanel } from "@/features/backoffice/LiveEventsPanel";
import { AsyncContent } from "@/components/ui/AsyncContent";
import { Button } from "@/components/ui/Button";
import { ItemList } from "@/components/ui/ItemList";
import { ListRow, ListRowFooter, ListRowMain } from "@/components/ui/ListRow";
import { PageCard } from "@/components/ui/PageCard";
import { SplitLayout } from "@/components/ui/SplitLayout";
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
        <SplitLayout aside={<LiveEventsPanel />}>
            <PageCard
                action={<Button as={Link} to={"/sources/new"}>{"Create template"}</Button>}
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
                    <ItemList>
                        {sources.map((item) => {
                            return (
                                <ListRow key={item.id}>
                                    <ListRowMain>
                                        <div>
                                            <h3 className={"list-row__title"}><Link to={`/sources/${item.id}`}>{item.name}</Link></h3>
                                            <p className={"list-row__meta"}>{item.id}</p>
                                        </div>
                                        <strong className={"list-row__price"}>{item.updated_at === undefined ? "New" : `Updated ${formatDateTime(item.updated_at)}`}</strong>
                                    </ListRowMain>
                                    <ListRowFooter>
                                        <span>{item.created_at === undefined ? "Created recently" : `Created ${formatDateTime(item.created_at)}`}</span>
                                        <div className={"action-group"}>
                                            <Button as={Link} to={`/sources/${item.id}`} variant={"secondary"}>{"Edit"}</Button>
                                            <Button disabled={deleteMutation.isPending} onClick={() => { deleteMutation.mutate(item.id); }} variant={"secondary"}>{"Delete"}</Button>
                                        </div>
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
