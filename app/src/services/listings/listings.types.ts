/**
 * Mirrors the backend listing payload.
 */
export interface Listing {
    readonly currency: string;
    readonly external_id: string;
    readonly first_seen_at: string;
    readonly id: string;
    readonly last_seen_at: string;
    readonly latest_snapshot_at: string;
    readonly location: string;
    readonly price_amount: number;
    readonly source_id: string;
    readonly title: string;
    readonly url: string;
}

/**
 * Mirrors the backend price history event payload.
 */
export interface PriceEvent {
    readonly changed_at: string;
    readonly id: string;
    readonly listing_id: string;
    readonly new_amount: number;
    readonly previous_amount?: number;
}

/**
 * Describes listing list filters supported by the backend today.
 */
export interface ListingListFilters {
    readonly limit: number;
    readonly q: string;
    readonly source_id: string;
}

/**
 * Mirrors the backend listing detail envelope.
 */
export interface ListingDetailResponse {
    readonly item: Listing;
    readonly price_history: PriceEvent[];
}