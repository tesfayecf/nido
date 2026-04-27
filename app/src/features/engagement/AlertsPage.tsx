import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
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
    const [createOpen, setCreateOpen] = useState(false);
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
            setCreateOpen(false);
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
        <>
            <PageStack>
            <PageCard
                action={(
                    <Button iconBefore={<Icon name={"plus"} />} onClick={() => { setCreateOpen(true); }}>
                        {"Create"}
                    </Button>
                )}
                description={"Active rules stay attached to their property until you delete them."}
                title={"Alerts"}
            >
                <AsyncContent
                    emptyMessage={"No alert rules have been created yet."}
                    errorMessage={"Could not load alert rules."}
                    isEmpty={alertRulesQuery.isSuccess && alertRules.length === 0}
                    isError={alertRulesQuery.isError}
                    isLoading={alertRulesQuery.isLoading}
                    loadingMessage={"Loading alert rules..."}
                >
                    <DataTable
                        caption={"Current alert rules"}
                        columns={[
                            { cell: (item) => getRuleTypeLabel(item.rule_type), header: "Rule", id: "rule", sortValue: (item) => item.rule_type },
                            { cell: (item) => propertyLabelById.get(item.property_id) ?? item.property_id, header: "Property", id: "property" },
                            { cell: (item) => getRuleTypeLogic(item.rule_type, item.threshold_amount), header: "Condition", id: "condition", wrap: true },
                            { cell: (item) => item.threshold_amount === undefined ? "No threshold" : `${item.threshold_amount}`, header: "Threshold", id: "threshold" },
                            { cell: (item) => item.enabled ? "Active" : "Inactive", header: "Status", id: "status" },
                            {
                                align: "right",
                                cell: (item) => (
                                    <button aria-label={"Delete alert rule"} className={"icon-button icon-button--danger"} disabled={deleteMutation.isPending} onClick={() => { deleteMutation.mutate(item.id); }} title={"Delete"} type={"button"}>
                                        <Icon name={"trash"} />
                                    </button>
                                ),
                                header: "Actions",
                                id: "actions",
                                width: "6rem",
                            },
                        ]}
                        compact
                        emptyMessage={"No alert rules have been created yet."}
                        getRowId={(item) => item.id}
                        items={alertRules}
                        pageSize={12}
                    />
                </AsyncContent>
            </PageCard>
            </PageStack>
            <Dialog onOpenChange={setCreateOpen} open={createOpen} title={"Create alert rule"}>
                <FormGrid
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!submitDisabled) {
                            createMutation.mutate({
                                property_id: propertyId,
                                rule_type: ruleType,
                                threshold_amount: thresholdNeeded ? parsedThreshold : undefined,
                            });
                        }
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
                    <div className={"action-group"}>
                        <Button onClick={() => { setCreateOpen(false); }} type={"button"} variant={"secondary"}>{"Cancel"}</Button>
                        <Button disabled={submitDisabled} isLoading={createMutation.isPending} loadingLabel={"Saving rule"} type={"submit"}>{"Create rule"}</Button>
                    </div>
                </FormGrid>
            </Dialog>
        </>
    );
};
