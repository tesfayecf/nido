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
    removeEvent: (eventId: string, receivedAt: string) => void;
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
    removeEvent: (eventId: string, receivedAt: string) => {
        set((state) => ({ items: state.items.filter((item) => item.id !== eventId || item.received_at !== receivedAt) }));
    },
    setConnectionState: (connectionState: StreamConnectionState) => {
        set({ connectionState });
    },
}));
