/**
 * File: app/src/services/backoffice-runs/runs.types.ts
 *
 * Purpose:
 * Defines the backoffice-runs frontend API contract, request helpers, query keys, or shared service types.
 *
 * Responsibilities:
 * - Describe typed request and response boundaries
 * - Centralize API paths, query keys, or service helpers
 * - Keep backend integration details out of rendering components
 *
 * Inputs:
 * - Module imports, constants, browser APIs, or caller-provided parameters as declared below
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
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
 * - /docs/frontend/architecture-overview.md#api-contracts
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
export interface Run {
    readonly change_flags?: Record<string, boolean>;
    readonly config_version: number;
    readonly error_message?: string;
    readonly id: string;
    readonly is_valid: boolean;
    readonly observed_at: string;
    readonly property_id: string;
    readonly values: Record<string, string>;
}

/**
 * Documents the RunFilters type contract used by app/src/services/backoffice-runs/runs.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface RunFilters {
    readonly limit: number;
    readonly property_id: string;
}
