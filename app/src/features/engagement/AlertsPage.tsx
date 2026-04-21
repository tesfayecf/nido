import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AsyncContent } from "@/components/ui/AsyncContent";
import { PageCard } from "@/components/ui/PageCard";
import { parseOptionalNonNegativeInteger } from "@/lib/forms/number";
import { alertRuleKeys } from "@/services/alert-rules/alert-rules.keys";
import { createAlertRule, deleteAlertRule, listAlertRules } from "@/services/alert-rules/alert-rules.service";
import { propertyKeys } from "@/services/properties/properties.keys";
import { listProperties } from "@/services/properties/properties.service";

export const AlertsPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const [propertyId, setPropertyId] = useState("");
    const [ruleType, setRuleType] = useState("price_drop");
    const [thresholdAmount, setThresholdAmount] = useState("");
    const propertiesQuery = useQuery({
        queryFn: listProperties,
        queryKey: propertyKeys.list(),
    });
    const alertRulesQuery = useQuery({
        queryFn: listAlertRules,
        queryKey: alertRuleKeys.all(),
    });
    const createMutation = useMutation({
        mutationFn: createAlertRule,
        onSuccess() {
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
    const alertRules = alertRulesQuery.data ?? [];

    return (
        <div className={"page-stack"}>
            <PageCard description={"Alert rules are evaluated per property after each new run."} title={"Create Alert Rule"}>
                <form
                    className={"form-grid"}
                    onSubmit={(event) => {
                        event.preventDefault();
                        createMutation.mutate({
                            property_id: propertyId,
                            rule_type: ruleType,
                            threshold_amount: parseOptionalNonNegativeInteger(thresholdAmount),
                        });
                    }}
                >
                    <label className={"field"}>
                        <span className={"field__label"}>{"Property"}</span>
                        <select className={"field__control"} onChange={(event) => { setPropertyId(event.target.value); }} value={propertyId}>
                            <option value={""}>{"Select a property"}</option>
                            {(propertiesQuery.data ?? []).map((item) => {
                                return <option key={item.id} value={item.id}>{item.label !== "" ? item.label : item.url}</option>;
                            })}
                        </select>
                    </label>
                    <label className={"field"}>
                        <span className={"field__label"}>{"Rule type"}</span>
                        <select className={"field__control"} onChange={(event) => { setRuleType(event.target.value); }} value={ruleType}>
                            <option value={"price_drop"}>{"Price drop"}</option>
                            <option value={"price_below"}>{"Price below threshold"}</option>
                        </select>
                    </label>
                    <label className={"field"}>
                        <span className={"field__label"}>{"Threshold amount"}</span>
                        <input className={"field__control"} min={0} onChange={(event) => { setThresholdAmount(event.target.value); }} step={1} type={"number"} value={thresholdAmount} />
                    </label>
                    <div className={"field field--actions"}>
                        <button className={"button"} disabled={createMutation.isPending || propertyId === ""} type={"submit"}>{createMutation.isPending ? "Saving..." : "Create rule"}</button>
                    </div>
                </form>
            </PageCard>

            <PageCard description={"Active rules stay attached to their property until you delete them."} title={"Current Alert Rules"}>
                <AsyncContent
                    emptyMessage={"No alert rules have been created yet."}
                    errorMessage={"Could not load alert rules."}
                    isEmpty={alertRulesQuery.isSuccess && alertRules.length === 0}
                    isError={alertRulesQuery.isError}
                    isLoading={alertRulesQuery.isLoading}
                    loadingMessage={"Loading alert rules..."}
                >
                    <div className={"item-list"}>
                        {alertRules.map((item) => {
                            return (
                                <article className={"list-row"} key={item.id}>
                                    <div className={"list-row__main"}>
                                        <div>
                                            <h3 className={"list-row__title"}>{item.rule_type}</h3>
                                            <p className={"list-row__meta"}>{"Property "}{item.property_id}</p>
                                        </div>
                                        <strong className={"list-row__price"}>{item.threshold_amount === undefined ? "No threshold" : `${item.threshold_amount}`}</strong>
                                    </div>
                                    <div className={"list-row__footer"}>
                                        <span>{item.enabled ? "Active" : "Inactive"}</span>
                                        <button className={"button button--secondary"} disabled={deleteMutation.isPending} onClick={() => { deleteMutation.mutate(item.id); }} type={"button"}>{"Delete"}</button>
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
