/**
 * File: app/src/services/notifications/notifications.types.ts
 *
 * Purpose:
 * Defines the notifications frontend API contract, request helpers, query keys, or shared service types.
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
export interface Notification {
    readonly alert_id?: string;
    readonly body: string;
    readonly created_at: string;
    readonly data?: unknown;
    readonly delivery_status: string;
    readonly id: string;
    readonly kind: string;
    readonly property_id?: string;
    readonly read_at?: string;
    readonly title: string;
    readonly user_id: string;
}

/**
 * Documents the NotificationFilters type contract used by app/src/services/notifications/notifications.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface NotificationFilters {
    readonly limit: number;
    readonly unread_only: boolean;
}
