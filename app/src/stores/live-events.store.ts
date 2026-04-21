import { create } from "zustand";

import type { BackofficeEvent } from "@/services/backoffice-events/events.types";
import type { StreamConnectionState } from "@/lib/api/sse";

/**
 * Describes the in-memory live event rail state.
 */
interface LiveEventsState {
    readonly connectionState: StreamConnectionState;
    readonly items: BackofficeEvent[];
    addEvent: (event: BackofficeEvent) => void;
    clearEvents: () => void;
    setConnectionState: (state: StreamConnectionState) => void;
}

const MAX_EVENT_ITEMS = 40;

/**
 * Stores recent live backoffice events for the current browser session.
 */
export const useLiveEventsStore = create<LiveEventsState>((set) => ({
    connectionState: "closed",
    items: [],
    addEvent: (event: BackofficeEvent) => {
        set((state) => ({ items: [event, ...state.items].slice(0, MAX_EVENT_ITEMS) }));
    },
    clearEvents: () => {
        set({ items: [] });
    },
    setConnectionState: (connectionState: StreamConnectionState) => {
        set({ connectionState });
    },
}));