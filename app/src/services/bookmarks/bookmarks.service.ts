import { apiRequest, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";

import type { BookmarkedListing } from "@/services/bookmarks/bookmarks.types";

/**
 * Loads the current bookmark list.
 *
 * @returns The current bookmark payloads.
 */
export const listBookmarks = async (): Promise<BookmarkedListing[]> => {
    const response = await apiRequest<ListEnvelope<BookmarkedListing>>({
        auth: true,
        path: "/api/v1/me/bookmarks",
    });

    return response.items;
};

/**
 * Creates one bookmark for the supplied listing.
 *
 * @param listingId The listing identifier to save.
 */
export const createBookmark = async (listingId: string): Promise<void> => {
    await apiRequest<StatusEnvelope, { listing_id: string; }>({
        auth: true,
        body: { listing_id: listingId },
        method: "POST",
        path: "/api/v1/me/bookmarks",
    });
};

/**
 * Deletes one bookmark.
 *
 * @param listingId The listing identifier to remove.
 */
export const deleteBookmark = async (listingId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/me/bookmarks/${listingId}`,
    });
};