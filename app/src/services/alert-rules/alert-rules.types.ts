/**
 * Mirrors the backend alert-rule payload.
 */
export interface AlertRule {
    readonly created_at: string;
    readonly enabled: boolean;
    readonly id: string;
    readonly listing_id?: string;
    readonly rule_type: string;
    readonly threshold_amount?: number;
    readonly updated_at: string;
    readonly user_id: string;
    readonly watchlist_id?: string;
}

/**
 * Describes an alert-rule creation request.
 */
export interface CreateAlertRuleRequest {
    readonly listing_id: string;
    readonly rule_type: string;
    readonly threshold_amount?: number;
    readonly watchlist_id: string;
}