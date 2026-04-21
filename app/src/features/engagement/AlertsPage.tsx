import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageCard } from "@/components/ui/PageCard";
import { parseOptionalNonNegativeInteger } from "@/lib/forms/number";
import { alertRuleKeys } from "@/services/alert-rules/alert-rules.keys";
import { createAlertRule, deleteAlertRule, listAlertRules } from "@/services/alert-rules/alert-rules.service";
import { watchlistKeys } from "@/services/watchlists/watchlists.keys";
import { listWatchlists } from "@/services/watchlists/watchlists.service";

/**
 * Hosts the alert rules route.
 *
 * @returns The placeholder alert-rule screen.
 */
export const AlertsPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const [watchlistId, setWatchlistId] = useState("");
    const [listingId, setListingId] = useState("");
    const [ruleType, setRuleType] = useState("new_listing");
    const [thresholdAmount, setThresholdAmount] = useState("");
    const watchlistsQuery = useQuery({
        queryFn: listWatchlists,
        queryKey: watchlistKeys.all(),
    });
    const alertRulesQuery = useQuery({
        queryFn: listAlertRules,
        queryKey: alertRuleKeys.all(),
    });
    const createMutation = useMutation({
        mutationFn: createAlertRule,
        onSuccess() {
            setListingId("");
            setThresholdAmount("");
            void queryClient.invalidateQueries({ queryKey: alertRuleKeys.all() });
        },
    });
    const deleteMutation = useMutation({
        mutationFn: deleteAlertRule,
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: alertRuleKeys.all() });
        },
    });

    return (
        <div className={"page-stack"}>
            <PageCard description={"Alert rules map directly to the current backend rule types and ids."} title={"Create Alert Rule"}>
                <form
                    className={"form-grid"}
                    onSubmit={(event) => {
                        event.preventDefault();
                        createMutation.mutate({
                            listing_id: listingId,
                            rule_type: ruleType,
                            threshold_amount: parseOptionalNonNegativeInteger(thresholdAmount),
                            watchlist_id: watchlistId,
                        });
                    }}
                >
                    <label className={"field"}>
                        <span className={"field__label"}>{"Rule type"}</span>
                        <select className={"field__control"} onChange={(event) => { setRuleType(event.target.value); }} value={ruleType}>
                            <option value={"new_listing"}>{"New listing"}</option>
                            <option value={"price_drop"}>{"Price drop"}</option>
                            <option value={"price_below"}>{"Price below threshold"}</option>
                        </select>
                    </label>

                    <label className={"field"}>
                        <span className={"field__label"}>{"Watchlist"}</span>
                        <select className={"field__control"} onChange={(event) => { setWatchlistId(event.target.value); }} value={watchlistId}>
                            <option value={""}>{"None"}</option>
                            {(watchlistsQuery.data ?? []).map((item) => {
                                return <option key={item.id} value={item.id}>{item.name}</option>;
                            })}
                        </select>
                    </label>

                    <label className={"field"}>
                        <span className={"field__label"}>{"Listing id"}</span>
                        <input className={"field__control"} onChange={(event) => { setListingId(event.target.value); }} value={listingId} />
                    </label>

                    <label className={"field"}>
                        <span className={"field__label"}>{"Threshold amount"}</span>
                        <input className={"field__control"} min={0} onChange={(event) => { setThresholdAmount(event.target.value); }} step={1} type={"number"} value={thresholdAmount} />
                    </label>

                    <div className={"field field--actions"}>
                        <button className={"button"} disabled={createMutation.isPending} type={"submit"}>
                            {createMutation.isPending ? "Saving..." : "Create rule"}
                        </button>
                    </div>
                </form>
            </PageCard>

            <PageCard description={"Rules currently return ids only, so this page keeps the target presentation intentionally literal."} title={"Current Alert Rules"}>
                {alertRulesQuery.isLoading ? <p className={"muted-copy"}>{"Loading alert rules..."}</p> : null}
                {alertRulesQuery.isError ? <p className={"error-banner"}>{"Could not load alert rules."}</p> : null}
                {alertRulesQuery.isSuccess && alertRulesQuery.data.length === 0 ? <EmptyState message={"No alert rules have been created yet."} /> : null}
                {alertRulesQuery.data !== undefined && alertRulesQuery.data.length > 0 ? (
                    <div className={"item-list"}>
                        {alertRulesQuery.data.map((item) => {
                            return (
                                <article className={"list-row"} key={item.id}>
                                    <div className={"list-row__main"}>
                                        <div>
                                            <h3 className={"list-row__title"}>{item.rule_type}</h3>
                                            <p className={"list-row__meta"}>{"Watchlist "}{item.watchlist_id ?? "—"}{" · Listing "}{item.listing_id ?? "—"}</p>
                                        </div>
                                        <strong className={"list-row__price"}>{item.threshold_amount === undefined ? "No threshold" : `${item.threshold_amount}`}</strong>
                                    </div>
                                    <div className={"list-row__footer"}>
                                        <span>{item.enabled ? "Enabled" : "Disabled"}</span>
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
                ) : null}
            </PageCard>
        </div>
    );
};