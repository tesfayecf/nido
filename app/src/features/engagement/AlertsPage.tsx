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
import { ALERT_RULE_TYPES, getRuleTypeLabel, getRuleTypeLogic, ruleRequiresThreshold } from "@/services/alert-rules/alert-rules.constants";
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
        queryFn: () => listProperties(),
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
    const properties = propertiesQuery.data ?? [];
    const propertyLabelById = new Map(properties.map((item) => [item.id, item.label !== "" ? item.label : item.url]));
    const thresholdNeeded = ruleRequiresThreshold(ruleType);
    const parsedThreshold = parseOptionalNonNegativeInteger(thresholdAmount);
    const submitDisabled = propertyId === "" || (thresholdNeeded && parsedThreshold === undefined);

    return (
        <PageStack>
            <PageCard description={"Alert rules are evaluated per property after each new run."} title={"Create Alert Rule"}>
                <FormGrid
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (submitDisabled) {
                            return;
                        }

                        createMutation.mutate({
                            property_id: propertyId,
                            rule_type: ruleType,
                            threshold_amount: thresholdNeeded ? parsedThreshold : undefined,
                        });
                    }}
                >
                    <Field label={"Property"}>
                        <Select onChange={(event) => { setPropertyId(event.target.value); }} value={propertyId}>
                            <option value={""}>{"Select a property"}</option>
                            {properties.map((item) => {
                                return <option key={item.id} value={item.id}>{item.label !== "" ? item.label : item.url}</option>;
                            })}
                        </Select>
                    </Field>
                    <Field hint={getRuleTypeLogic(ruleType, parsedThreshold)} label={"Rule type"}>
                        <Select onChange={(event) => { setRuleType(event.target.value); }} value={ruleType}>
                            {ALERT_RULE_TYPES.map((option) => {
                                return <option key={option.value} value={option.value}>{option.description}</option>;
                            })}
                        </Select>
                    </Field>
                    {thresholdNeeded ? (
                        <Field hint={"Whole number, in the same unit as the tracked field."} label={"Threshold amount"}>
                            <Input min={0} onChange={(event) => { setThresholdAmount(event.target.value); }} step={1} type={"number"} value={thresholdAmount} />
                        </Field>
                    ) : null}
                    <Field as={"div"} variant={"actions"}>
                        <Button disabled={submitDisabled} isLoading={createMutation.isPending} loadingLabel={"Saving rule"} type={"submit"}>
                            {"Create rule"}
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
                                            <h3 className={"list-row__title"}>{getRuleTypeLabel(item.rule_type)}</h3>
                                            <p className={"list-row__meta"}>
                                                {"When "}
                                                <strong>{propertyLabelById.get(item.property_id) ?? item.property_id}</strong>
                                                {" "}{getRuleTypeLogic(item.rule_type, item.threshold_amount)}
                                            </p>
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
