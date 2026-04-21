import { apiRequest, type ItemEnvelope, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";

import type { CreateWatchlistRequest, Watchlist } from "@/services/watchlists/watchlists.types";

/**
 * Loads all watchlists for the current user.
 *
 * @returns The current watchlist collection.
 */
export const listWatchlists = async (): Promise<Watchlist[]> => {
    const response = await apiRequest<ListEnvelope<Watchlist>>({
        auth: true,
        path: "/api/v1/me/watchlists",
    });

    return response.items;
};

/**
 * Creates one watchlist.
 *
 * @param request The watchlist request body.
 * @returns The stored watchlist returned by the backend.
 */
export const createWatchlist = async (request: CreateWatchlistRequest): Promise<Watchlist> => {
    const response = await apiRequest<ItemEnvelope<Watchlist>, CreateWatchlistRequest>({
        auth: true,
        body: request,
        method: "POST",
        path: "/api/v1/me/watchlists",
    });

    return response.item;
};

/**
 * Deletes one watchlist.
 *
 * @param watchlistId The watchlist identifier to delete.
 */
export const deleteWatchlist = async (watchlistId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/me/watchlists/${watchlistId}`,
    });
};