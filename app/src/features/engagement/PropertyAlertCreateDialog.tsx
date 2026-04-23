import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";
import { parseOptionalNonNegativeInteger } from "@/lib/forms/number";
import { alertRuleKeys } from "@/services/alert-rules/alert-rules.keys";
import { ALERT_RULE_TYPES, getRuleTypeLabel } from "@/services/alert-rules/alert-rules.constants";
import { createAlertRule } from "@/services/alert-rules/alert-rules.service";

interface PropertyAlertCreateDialogProps {
    readonly onOpenChange: (open: boolean) => void;
    readonly open: boolean;
    readonly propertyId: string;
    readonly propertyLabel: string;
}

const requiresThreshold = (ruleType: string): boolean => {
    return ruleType === "price_below" || ruleType === "price_above";
};

export const PropertyAlertCreateDialog = ({
    onOpenChange,
    open,
    propertyId,
    propertyLabel,
}: PropertyAlertCreateDialogProps): JSX.Element => {
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [ruleType, setRuleType] = useState<string>("price_drop");
    const [thresholdAmount, setThresholdAmount] = useState("");

    const createMutation = useMutation({
        mutationFn: createAlertRule,
        onError() {
            pushToast("Could not create alert rule.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: alertRuleKeys.all() });
            pushToast("Alert created.", "success");
            setThresholdAmount("");
            setRuleType("price_drop");
            onOpenChange(false);
        },
    });

    const thresholdNeeded = requiresThreshold(ruleType);
    const thresholdValue = parseOptionalNonNegativeInteger(thresholdAmount);
    const isReady = !thresholdNeeded || thresholdValue !== undefined;

    return (
        <Dialog
            description={`Alerts run automatically after each new snapshot for ${propertyLabel}.`}
            onOpenChange={onOpenChange}
            open={open}
            title={"Create alert"}
        >
            <FormGrid
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!isReady) {
                        return;
                    }

                    createMutation.mutate({
                        property_id: propertyId,
                        rule_type: ruleType,
                        threshold_amount: thresholdNeeded ? thresholdValue : undefined,
                    });
                }}
            >
                <Field hint={"Choose how this property should be monitored."} label={"Rule type"}>
                    <Select onChange={(event) => { setRuleType(event.target.value); }} value={ruleType}>
                        {ALERT_RULE_TYPES.map((option) => {
                            return <option key={option.value} value={option.value}>{getRuleTypeLabel(option.value)}</option>;
                        })}
                    </Select>
                </Field>
                {thresholdNeeded ? (
                    <Field hint={"Whole number, in the same unit as the tracked field."} label={"Threshold"}>
                        <Input
                            min={0}
                            onChange={(event) => { setThresholdAmount(event.target.value); }}
                            step={1}
                            type={"number"}
                            value={thresholdAmount}
                        />
                    </Field>
                ) : null}
                {createMutation.isError ? <ErrorBanner>{"Could not save the alert rule."}</ErrorBanner> : null}
                <ActionGroup>
                    <Button onClick={() => { onOpenChange(false); }} variant={"secondary"} type={"button"}>{"Cancel"}</Button>
                    <Button disabled={!isReady} isLoading={createMutation.isPending} type={"submit"}>{"Create alert"}</Button>
                </ActionGroup>
            </FormGrid>
        </Dialog>
    );
};
