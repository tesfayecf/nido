/**
 * File: app/src/lib/format/currency.ts
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
 * Formats a numeric price into a currency string.
 *
 * @param amount The price amount in whole units.
 * @param currency The ISO-like currency code from the backend.
 * @returns A localized currency string.
 */
export const formatCurrency = (amount: number, currency: string): string => {
    return new Intl.NumberFormat("en", {
        currency,
        maximumFractionDigits: 0,
        style: "currency",
    }).format(amount);
};