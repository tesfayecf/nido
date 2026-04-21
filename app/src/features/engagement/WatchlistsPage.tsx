import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AsyncContent } from "@/components/ui/AsyncContent";
import { PageCard } from "@/components/ui/PageCard";
import { formatDateTime } from "@/lib/format/date";
import { parseOptionalNonNegativeInteger } from "@/lib/forms/number";
import { watchlistKeys } from "@/services/watchlists/watchlists.keys";
import { createWatchlist, deleteWatchlist, listWatchlists } from "@/services/watchlists/watchlists.service";

/**
 * Hosts the watchlists route.
 *
 * @returns The placeholder watchlists screen.
 */
export const WatchlistsPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const [name, setName] = useState("");
    const [query, setQuery] = useState("");
    const [sourceId, setSourceId] = useState("");
    const [maxPriceAmount, setMaxPriceAmount] = useState("");
    const watchlistsQuery = useQuery({
        queryFn: listWatchlists,
        queryKey: watchlistKeys.all(),
    });
    const createMutation = useMutation({
        mutationFn: createWatchlist,
        onSuccess() {
            setName("");
            setQuery("");
            setSourceId("");
            setMaxPriceAmount("");
            void queryClient.invalidateQueries({ queryKey: watchlistKeys.all() });
        },
    });
    const deleteMutation = useMutation({
        mutationFn: deleteWatchlist,
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: watchlistKeys.all() });
        },
    });
    const watchlists = watchlistsQuery.data ?? [];

    return (
        <div className={"page-stack"}>
            <PageCard description={"Watchlists are lightweight saved queries evaluated by the backend during ingestion."} title={"Create Watchlist"}>
                <form
                    className={"form-grid"}
                    onSubmit={(event) => {
                        event.preventDefault();
                        createMutation.mutate({
                            max_price_amount: parseOptionalNonNegativeInteger(maxPriceAmount),
                            name,
                            query,
                            source_id: sourceId,
                        });
                    }}
                >
                    <label className={"field"}>
                        <span className={"field__label"}>{"Name"}</span>
                        <input className={"field__control"} onChange={(event) => { setName(event.target.value); }} value={name} />
                    </label>

                    <label className={"field"}>
                        <span className={"field__label"}>{"Text query"}</span>
                        <input className={"field__control"} onChange={(event) => { setQuery(event.target.value); }} value={query} />
                    </label>

                    <label className={"field"}>
                        <span className={"field__label"}>{"Source id"}</span>
                        <input className={"field__control"} onChange={(event) => { setSourceId(event.target.value); }} value={sourceId} />
                    </label>

                    <label className={"field"}>
                        <span className={"field__label"}>{"Max price amount"}</span>
                        <input className={"field__control"} min={0} onChange={(event) => { setMaxPriceAmount(event.target.value); }} step={1} type={"number"} value={maxPriceAmount} />
                    </label>

                    <div className={"field field--actions"}>
                        <button className={"button"} disabled={createMutation.isPending} type={"submit"}>
                            {createMutation.isPending ? "Saving..." : "Create watchlist"}
                        </button>
                    </div>
                </form>
            </PageCard>

            <PageCard description={"The current backend supports list, create, and delete operations for watchlists."} title={"Current Watchlists"}>
                <AsyncContent
                    emptyMessage={"No watchlists have been created yet."}
                    errorMessage={"Could not load watchlists."}
                    isEmpty={watchlistsQuery.isSuccess && watchlists.length === 0}
                    isError={watchlistsQuery.isError}
                    isLoading={watchlistsQuery.isLoading}
                    loadingMessage={"Loading watchlists..."}
                >
                    <div className={"item-list"}>
                        {watchlists.map((item) => {
                            return (
                                <article className={"list-row"} key={item.id}>
                                    <div className={"list-row__main"}>
                                        <div>
                                            <h3 className={"list-row__title"}>{item.name}</h3>
                                            <p className={"list-row__meta"}>
                                                {"Query "}{item.query ?? "—"}{" · source "}{item.source_id ?? "any"}{" · updated "}{formatDateTime(item.updated_at)}
                                            </p>
                                        </div>
                                        <strong className={"list-row__price"}>{item.max_price_amount === undefined ? "No ceiling" : `${item.max_price_amount}`}</strong>
                                    </div>
                                    <div className={"list-row__footer"}>
                                        <span>{"Created "}{formatDateTime(item.created_at)}</span>
                                        <button
                                            className={"button button--secondary"}
                                            disabled={deleteMutation.isPending}
                                            onClick={() => {
                                                deleteMutation.mutate(item.id);
                                            }}
                                            type={"button"}
                                        >
                                            {"Delete"}
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </AsyncContent>
            </PageCard>
        </div>
    );
};
