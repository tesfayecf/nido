/**
 * File: app/src/lib/api/errors.ts
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
 * - Module imports, constants, browser APIs, or caller-provided parameters as declared below
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - TypeScript compiler
 * - Vite module graph
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