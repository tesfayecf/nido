import { ApiError } from "@/lib/api/errors";
import { clearAuthenticatedClientState } from "@/lib/auth/session";
import { useSessionStore } from "@/stores/session.store";

/**
 * Represents the backend list envelope shape.
 */
export interface ListEnvelope<TItem> {
    readonly count: number;
    readonly items: TItem[];
}

/**
 * Represents the backend single-item envelope shape.
 */
export interface ItemEnvelope<TItem> {
    readonly item: TItem;
}

/**
 * Represents the backend status-only response shape.
 */
export interface StatusEnvelope {
    readonly status: string;
}

interface ApiRequestOptions<TBody> {
    readonly auth?: boolean;
    readonly body?: TBody;
    readonly headers?: HeadersInit;
    readonly method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
    readonly path: string;
    readonly signal?: AbortSignal;
}

const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN ?? "").replace(/\/$/, "");

/**
 * Executes one typed HTTP request against the backend.
 *
 * @param options The request configuration.
 * @returns The parsed JSON response payload.
 */
export const apiRequest = async <TResponse, TBody = unknown>(options: ApiRequestOptions<TBody>): Promise<TResponse> => {
    const headers = new Headers(options.headers);

    if (options.body !== undefined && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    if (options.auth === true) {
        const token = useSessionStore.getState().token;
        if (token === null) {
            throw new ApiError("Authentication required.", 401);
        }

        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(buildApiUrl(options.path), {
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        headers,
        method: options.method ?? "GET",
        signal: options.signal,
    });

    const payload = await readPayload(response);

    if (!response.ok) {
        if (response.status === 401) {
            clearAuthenticatedClientState();
        }

        const message = readErrorMessage(payload) ?? (response.statusText || "Request failed.");
        throw new ApiError(message, response.status, payload);
    }

    return payload as TResponse;
};

/**
 * Builds a stable API URL from a relative backend path.
 *
 * @param path The backend path.
 * @returns The resolved request URL.
 */
export const buildApiUrl = (path: string): string => {
    if (/^https?:\/\//u.test(path)) {
        return path;
    }

    return `${API_ORIGIN}${path}`;
};

const readPayload = async (response: Response): Promise<unknown> => {
    const rawText = await response.text();
    if (rawText.trim() === "") {
        return null;
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
        return JSON.parse(rawText) as unknown;
    }

    try {
        return JSON.parse(rawText) as unknown;
    } catch {
        return rawText;
    }
};

const readErrorMessage = (payload: unknown): string | null => {
    if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string") {
        return payload.error;
    }

    if (typeof payload === "string" && payload.trim() !== "") {
        return payload;
    }

    return null;
};