/**
 * Mirrors the backend bookmark listing payload.
 */
export interface BookmarkedListing {
    readonly bookmarked_at: string;
    readonly currency: string;
    readonly listing_id: string;
    readonly location: string;
    readonly price_amount: number;
    readonly source_id: string;
    readonly title: string;
    readonly url: string;
}