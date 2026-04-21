import { useMemo } from "react";

import { useSearchSessionStore } from "@/stores/search-session.store";

interface UseMapBoundsResult {
    readonly bounds: ReturnType<typeof useSearchSessionStore.getState>["bounds"];
    readonly moveEast: () => void;
    readonly moveNorth: () => void;
    readonly moveSouth: () => void;
    readonly moveWest: () => void;
    readonly searchAsMove: boolean;
    readonly setSearchAsMove: (enabled: boolean) => void;
    readonly zoomIn: () => void;
    readonly zoomLevel: number;
    readonly zoomOut: () => void;
}

/**
 * Exposes the active market viewport controls backed by the search-session
 * store.
 *
 * The current backend listing contract has no coordinates yet, so this hook
 * prepares the session boundary used by the UI and future geospatial fetchers
 * without forcing the route to know about Zustand details.
 *
 * @returns The viewport bounds, zoom level, search-as-move state, and helpers.
 */
export const useMapBounds = (): UseMapBoundsResult => {
    const bounds = useSearchSessionStore((state) => state.bounds);
    const panViewport = useSearchSessionStore((state) => state.panViewport);
    const searchAsMove = useSearchSessionStore((state) => state.searchAsMove);
    const setSearchAsMove = useSearchSessionStore((state) => state.setSearchAsMove);
    const zoomBy = useSearchSessionStore((state) => state.zoomBy);
    const zoomLevel = useSearchSessionStore((state) => state.zoomLevel);

    return useMemo(() => ({
        bounds,
        moveEast: () => {
            panViewport(0, 0.035);
        },
        moveNorth: () => {
            panViewport(0.03, 0);
        },
        moveSouth: () => {
            panViewport(-0.03, 0);
        },
        moveWest: () => {
            panViewport(0, -0.035);
        },
        searchAsMove,
        setSearchAsMove,
        zoomIn: () => {
            zoomBy(1);
        },
        zoomLevel,
        zoomOut: () => {
            zoomBy(-1);
        },
    }), [bounds, panViewport, searchAsMove, setSearchAsMove, zoomBy, zoomLevel]);
};
