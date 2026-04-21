import { apiRequest, type ItemEnvelope, type ListEnvelope } from "@/lib/api/client";

import type { Listing, ListingDetailResponse, ListingListFilters } from "@/services/listings/listings.types";

/**
 * Loads the current listing explorer result set.
 *
 * @param filters The backend-supported list filters.
 * @returns The listing items returned by the backend.
 */
export const listListings = async (filters: ListingListFilters): Promise<ListEnvelope<Listing>> => {
    const params = new URLSearchParams();

    if (filters.q.trim() !== "") {
        params.set("q", filters.q.trim());
    }

    if (filters.source_id.trim() !== "") {
        params.set("source_id", filters.source_id.trim());
    }

    if (filters.limit > 0) {
        params.set("limit", `${filters.limit}`);
    }

    const suffix = params.toString() === "" ? "" : `?${params.toString()}`;
    return apiRequest<ListEnvelope<Listing>>({ path: `/api/v1/listings${suffix}` });
};

/**
 * Loads one listing detail and its price history.
 *
 * @param listingId The listing identifier.
 * @returns The listing detail payload.
 */
export const getListingDetail = (listingId: string): Promise<ListingDetailResponse> => {
    return apiRequest<ListingDetailResponse>({ path: `/api/v1/listings/${listingId}` });
};