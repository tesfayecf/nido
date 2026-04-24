export interface AlertRule {
    readonly created_at: string;
    readonly enabled: boolean;
    readonly id: string;
    readonly property_id: string;
    readonly rule_type: string;
    readonly threshold_amount?: number;
    readonly updated_at: string;
}

export interface CreateAlertRuleRequest {
    readonly property_id: string;
    readonly rule_type: string;
    readonly threshold_amount?: number;
}
