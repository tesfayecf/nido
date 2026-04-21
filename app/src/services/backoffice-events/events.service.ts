import type { EventSourceMessage } from "@microsoft/fetch-event-source";

import { connectAuthenticatedStream, type StreamConnectionState } from "@/lib/api/sse";

import type { BackofficeEvent } from "@/services/backoffice-events/events.types";

interface ConnectBackofficeEventsOptions {
    readonly onConnectionStateChange?: (state: StreamConnectionState) => void;
    readonly onEvent: (event: BackofficeEvent) => void;
    readonly signal: AbortSignal;
}

/**
 * Opens the backend backoffice event stream and emits typed events.
 *
 * @param options The stream callbacks and cancellation signal.
 */
export const connectBackofficeEvents = async (options: ConnectBackofficeEventsOptions): Promise<void> => {
    await connectAuthenticatedStream({
        onConnectionStateChange: options.onConnectionStateChange,
        onMessage(message) {
            const event = decodeEvent(message);
            if (event !== null) {
                options.onEvent(event);
            }
        },
        path: "/api/v1/backoffice/events",
        signal: options.signal,
    });
};

const decodeEvent = (message: EventSourceMessage): BackofficeEvent | null => {
    if (message.data.trim() === "") {
        return null;
    }

    const parsed = JSON.parse(message.data) as Record<string, unknown>;

    return {
        data: parsed,
        id: message.id,
        received_at: new Date().toISOString(),
        type: message.event,
    };
};