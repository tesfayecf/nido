/**
 * File: app/src/lib/api/client.ts
 *
 * Purpose:
 * Provides a shared frontend utility that centralizes cross-feature behavior.
 *
 * Responsibilities:
 * - Define typed frontend behavior for its module boundary
 * - Keep inputs and outputs explicit for maintainability
 * - Reference related modules so changes can be traced safely
 *
 * Inputs:
 * - Imports: @/lib/api/errors, @/lib/auth/session, @/stores/session.store
 * - Environment configuration read at runtime or build time
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - @/lib/api/errors
 * - @/lib/auth/session
 * - @/stores/session.store
 *
 * Key Decisions:
 * - Keeps documentation adjacent to the implementation so future changes update behavior and context together.
 * - Uses explicit imports and typed boundaries to make ownership traceable from this file in isolation.
 *
 * Constraints:
 * - Documentation must remain synchronized with behavior, tests, and related docs when this file changes.
 * - Runtime behavior must not depend on comments or documentation-only metadata.
 *
 * Related:
 * - /docs/frontend/documentation-template.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
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
            /*
             * Critical point: authenticated requests must fail before fetch when no bearer token exists.
             * Sending unauthenticated protected requests would produce ambiguous backend errors and leave the
             * session store out of sync with the UI's auth boundary.
             */
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
            /*
             * Critical point: a backend 401 invalidates the persisted client session immediately.
             * Removing this reset would let stale tokens continue driving protected UI state after the server
             * has rejected the session.
             */
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
