import type { ListingListFilters } from "@/services/listings/listings.types";

/**
 * Defines stable query keys for listing explorer data.
 */
export const listingKeys = {
    detail: (listingId: string) => ["listings", "detail", listingId] as const,
    list: (filters: ListingListFilters) => ["listings", "list", filters] as const,
};