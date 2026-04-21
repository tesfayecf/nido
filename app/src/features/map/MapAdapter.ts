/**
 * Describes the minimal map adapter contract reserved for future iterations.
 */
export interface MapAdapter {
    readonly available: boolean;
    readonly reason: string;
}

/**
 * Exposes the current no-op map adapter used until geospatial data exists.
 */
export const nullMapAdapter: MapAdapter = {
    available: false,
    reason: "The backend does not yet provide coordinates or area geometry.",
};