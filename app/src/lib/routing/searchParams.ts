/**
 * File: app/src/lib/routing/searchParams.ts
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
 * Reads one trimmed string query parameter.
 *
 * @param params The current URL search parameters.
 * @param key The key to read.
 * @returns The trimmed string value, or an empty string when absent.
 */
export const readStringParam = (params: URLSearchParams, key: string): string => {
    return (params.get(key) ?? "").trim();
};

/**
 * Reads one positive integer query parameter.
 *
 * @param params The current URL search parameters.
 * @param key The key to read.
 * @param fallback The fallback value used when parsing fails.
 * @returns A parsed positive integer.
 */
export const readNumberParam = (params: URLSearchParams, key: string, fallback: number): number => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") {
        return fallback;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return parsed;
};

/**
 * Reads one boolean query parameter.
 *
 * @param params The current URL search parameters.
 * @param key The key to read.
 * @param fallback The fallback value used when parsing fails.
 * @returns A parsed boolean value.
 */
export const readBooleanParam = (params: URLSearchParams, key: string, fallback: boolean): boolean => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") {
        return fallback;
    }

    return raw === "true";
};

/**
 * Updates one query parameter in a mutable URLSearchParams instance.
 *
 * @param params The mutable search parameter object.
 * @param key The parameter name.
 * @param value The new value to write, or nullish to delete the key.
 */
export const writeParam = (params: URLSearchParams, key: string, value: null | number | string | undefined): void => {
    if (value === undefined || value === null || `${value}`.trim() === "") {
        params.delete(key);
        return;
    }

    params.set(key, `${value}`);
};