/**
 * File: app/src/services/backoffice-sources/sources.types.ts
 *
 * Purpose:
 * Defines the backoffice-sources frontend API contract, request helpers, query keys, or shared service types.
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
export interface Source {
    readonly active?: boolean;
    readonly browser_enabled?: boolean;
    readonly config_json?: string;
    readonly created_at?: string;
    readonly endpoint_url?: string;
    readonly freshness_window_seconds?: number;
    readonly id: string;
    readonly kind?: string;
    readonly last_run_at?: string;
    readonly name: string;
    readonly next_run_at?: string;
    readonly rate_limit_max_requests?: number;
    readonly rate_limit_window_seconds?: number;
    readonly retry_backoff_millis?: number;
    readonly retry_max_attempts?: number;
    readonly schedule_interval_seconds?: number;
    readonly updated_at?: string;
}
