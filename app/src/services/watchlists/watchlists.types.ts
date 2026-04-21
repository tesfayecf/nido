/**
 * Mirrors the backend watchlist payload.
 */
export interface Watchlist {
    readonly created_at: string;
    readonly id: string;
    readonly max_price_amount?: number;
    readonly name: string;
    readonly query?: string;
    readonly source_id?: string;
    readonly updated_at: string;
    readonly user_id: string;
}

/**
 * Describes a watchlist creation request.
 */
export interface CreateWatchlistRequest {
    readonly max_price_amount?: number;
    readonly name: string;
    readonly query: string;
    readonly source_id: string;
}