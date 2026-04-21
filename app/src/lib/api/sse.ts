import { fetchEventSource, type EventSourceMessage } from "@microsoft/fetch-event-source";

import { ApiError } from "@/lib/api/errors";
import { buildApiUrl } from "@/lib/api/client";
import { useSessionStore } from "@/stores/session.store";

/**
 * Describes the transport lifecycle for one SSE connection.
 */
export type StreamConnectionState = "closed" | "connecting" | "error" | "open";

interface ConnectAuthenticatedStreamOptions {
    readonly onConnectionStateChange?: (state: StreamConnectionState) => void;
    readonly onMessage: (message: EventSourceMessage) => void;
    readonly path: string;
    readonly signal: AbortSignal;
}

/**
 * Opens an authenticated SSE stream using a fetch-based client.
 *
 * Native EventSource cannot attach bearer headers. This helper keeps the stream
 * contract aligned with the backend while preserving auth.
 *
 * @param options The stream connection configuration.
 */
export const connectAuthenticatedStream = async (options: ConnectAuthenticatedStreamOptions): Promise<void> => {
    const token = useSessionStore.getState().token;
    if (token === null) {
        throw new ApiError("Authentication required.", 401);
    }

    options.onConnectionStateChange?.("connecting");

    await fetchEventSource(buildApiUrl(options.path), {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        method: "GET",
        openWhenHidden: true,
        signal: options.signal,
        async onopen(response) {
            if (!response.ok) {
                if (response.status === 401) {
                    useSessionStore.getState().clearSession();
                }

                throw new ApiError(`Stream connection failed with status ${response.status}.`, response.status);
            }

            options.onConnectionStateChange?.("open");
        },
        onmessage(message) {
            options.onMessage(message);
        },
        onclose() {
            options.onConnectionStateChange?.("closed");
        },
        onerror(error) {
            options.onConnectionStateChange?.("error");
            throw error;
        },
    });
};