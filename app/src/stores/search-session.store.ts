import { create } from "zustand";

import type { ListingSortOrder } from "@/features/listings/listingInsights";

/**
 * Describes the active map viewport bounds tracked for the current session.
 */
export interface MapBounds {
    readonly east: number;
    readonly north: number;
    readonly south: number;
    readonly west: number;
}

interface SearchSessionState {
    readonly bounds: MapBounds;
    readonly compareIds: string[];
    readonly searchAsMove: boolean;
    readonly sortOrder: ListingSortOrder;
    readonly zoomLevel: number;
    clearCompare: () => void;
    panViewport: (deltaNorth: number, deltaEast: number) => void;
    setSearchAsMove: (enabled: boolean) => void;
    setSortOrder: (sortOrder: ListingSortOrder) => void;
    toggleCompare: (listingId: string) => void;
    zoomBy: (delta: number) => void;
}

const DEFAULT_BOUNDS: MapBounds = {
    east: 2.98,
    north: 42.12,
    south: 41.92,
    west: 2.72,
};

/**
 * Stores the active market-exploration session state that should not be derived
 * from the URL alone, including viewport, session compare selection, and the
 * current search-as-I-move preference.
 */
export const useSearchSessionStore = create<SearchSessionState>((set) => ({
    bounds: DEFAULT_BOUNDS,
    compareIds: [],
    searchAsMove: true,
    sortOrder: "latest",
    zoomLevel: 11,
    clearCompare: () => {
        set({ compareIds: [] });
    },
    panViewport: (deltaNorth: number, deltaEast: number) => {
        set((state) => ({
            bounds: {
                east: Number((state.bounds.east + deltaEast).toFixed(3)),
                north: Number((state.bounds.north + deltaNorth).toFixed(3)),
                south: Number((state.bounds.south + deltaNorth).toFixed(3)),
                west: Number((state.bounds.west + deltaEast).toFixed(3)),
            },
        }));
    },
    setSearchAsMove: (searchAsMove: boolean) => {
        set({ searchAsMove });
    },
    setSortOrder: (sortOrder: ListingSortOrder) => {
        set({ sortOrder });
    },
    toggleCompare: (listingId: string) => {
        set((state) => {
            const exists = state.compareIds.includes(listingId);
            if (exists) {
                return { compareIds: state.compareIds.filter((item) => item !== listingId) };
            }

            return { compareIds: [...state.compareIds, listingId].slice(-3) };
        });
    },
    zoomBy: (delta: number) => {
        set((state) => ({ zoomLevel: Math.min(18, Math.max(7, state.zoomLevel + delta)) }));
    },
}));
