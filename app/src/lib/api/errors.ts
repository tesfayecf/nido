/**
 * Represents a normalized backend API error.
 */
export class ApiError extends Error {
    public readonly details?: unknown;
    public readonly status: number;

    /**
     * Creates a normalized API error instance.
     *
     * @param message The human-readable error message.
     * @param status The HTTP status code returned by the backend.
     * @param details Optional structured error payload.
     */
    public constructor(message: string, status: number, details?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.details = details;
    }
}

/**
 * Narrows an unknown thrown value to an ApiError.
 *
 * @param error The candidate error value.
 * @returns Whether the thrown value is an ApiError.
 */
export const isApiError = (error: unknown): error is ApiError => {
    return error instanceof ApiError;
};