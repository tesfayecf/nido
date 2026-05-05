/**
 * File: app/src/lib/forms/number.ts
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
 * Reads one non-negative number, falling back when parsing fails.
 *
 * @param value The raw form value.
 * @param fallback The fallback used when the value is invalid.
 * @returns A valid non-negative number.
 */
export const readNonNegativeNumber = (value: string, fallback: number): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }

    return parsed;
};

/**
 * Parses an optional non-negative integer from form input.
 *
 * @param value The raw form value.
 * @returns A safe non-negative integer, or undefined when the value is blank or invalid.
 */
export const parseOptionalNonNegativeInteger = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (trimmed === "") {
        return undefined;
    }

    const parsed = Number(trimmed);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
        return undefined;
    }

    return parsed;
};