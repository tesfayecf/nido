import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { ItemList } from "@/components/ui/ItemList";
import { ListRow, ListRowFooter, ListRowMain } from "@/components/ui/ListRow";
import { AsyncContent } from "@/components/ui/AsyncContent";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { Select } from "@/components/ui/Select";
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
        <PageStack>
            <PageCard description={"Alert rules are evaluated per property after each new run."} title={"Create Alert Rule"}>
                <FormGrid
                    onSubmit={(event) => {
                        event.preventDefault();
                        createMutation.mutate({
                            property_id: propertyId,
                            rule_type: ruleType,
                            threshold_amount: parseOptionalNonNegativeInteger(thresholdAmount),
                        });
                    }}
                >
                    <Field label={"Property"}>
                        <Select onChange={(event) => { setPropertyId(event.target.value); }} value={propertyId}>
                            <option value={""}>{"Select a property"}</option>
                            {(propertiesQuery.data ?? []).map((item) => {
                                return <option key={item.id} value={item.id}>{item.label !== "" ? item.label : item.url}</option>;
                            })}
                        </Select>
                    </Field>
                    <Field label={"Rule type"}>
                        <Select onChange={(event) => { setRuleType(event.target.value); }} value={ruleType}>
                            <option value={"price_drop"}>{"Price drop"}</option>
                            <option value={"price_below"}>{"Price below threshold"}</option>
                        </Select>
                    </Field>
                    <Field label={"Threshold amount"}>
                        <Input min={0} onChange={(event) => { setThresholdAmount(event.target.value); }} step={1} type={"number"} value={thresholdAmount} />
                    </Field>
                    <Field as={"div"} variant={"actions"}>
                        <Button disabled={propertyId === ""} isLoading={createMutation.isPending} loadingLabel={"Saving rule"} type={"submit"}>
                            {createMutation.isPending ? "Saving..." : "Create rule"}
                        </Button>
                    </Field>
                </FormGrid>
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
                    <ItemList>
                        {alertRules.map((item) => {
                            return (
                                <ListRow key={item.id}>
                                    <ListRowMain>
                                        <div>
                                            <h3 className={"list-row__title"}>{item.rule_type}</h3>
                                            <p className={"list-row__meta"}>{"Property "}{item.property_id}</p>
                                        </div>
                                        <strong className={"list-row__price"}>{item.threshold_amount === undefined ? "No threshold" : `${item.threshold_amount}`}</strong>
                                    </ListRowMain>
                                    <ListRowFooter>
                                        <span>{item.enabled ? "Active" : "Inactive"}</span>
                                        <Button disabled={deleteMutation.isPending} onClick={() => { deleteMutation.mutate(item.id); }} variant={"secondary"}>{"Delete"}</Button>
                                    </ListRowFooter>
                                </ListRow>
                            );
                        })}
                    </ItemList>
                </AsyncContent>
            </PageCard>
        </PageStack>
    );
};
