/**
 * Defines stable query keys for watchlist data.
 */
export const watchlistKeys = {
    all: () => ["me", "watchlists"] as const,
};