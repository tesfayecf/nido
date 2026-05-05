/**
 * File: app/src/lib/ui/sessionStorage.ts
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
export const readSessionStorageNumber = (key: string | undefined, fallback: number, options?: { readonly allowZero?: boolean; }): number => {
    const storedValue = key === undefined ? null : sessionStorage.getItem(key);
    const parsedValue = storedValue === null ? fallback : Number(storedValue);
    const isAllowed = options?.allowZero === true ? parsedValue >= 0 : parsedValue > 0;

    return Number.isInteger(parsedValue) && isAllowed ? parsedValue : fallback;
};
