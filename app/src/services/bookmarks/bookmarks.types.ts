/**
 * Mirrors the backend bookmark property payload.
 */
export interface BookmarkedProperty {
    readonly bookmarked_at: string;
    readonly currency: string;
    readonly listing_id?: string;
    readonly location: string;
    readonly price_amount: number;
    readonly property_id: string;
    readonly source_id?: string;
    readonly title: string;
    readonly url: string;
}
