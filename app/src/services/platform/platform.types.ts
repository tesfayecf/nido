/**
 * File: app/src/services/platform/platform.types.ts
 *
 * Purpose:
 * Defines the platform frontend API contract, request helpers, query keys, or shared service types.
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
export interface IntegrationChannelConfig {
    readonly url?: string;
    readonly events?: string[];
}

/**
 * Documents the EmailDigestConfig type contract used by app/src/services/platform/platform.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface EmailDigestConfig {
    readonly enabled: boolean;
    readonly recipient?: string;
    readonly schedule?: string;
    readonly events?: string[];
    readonly last_sent_at?: string;
}

/**
 * Documents the PlatformSettings type contract used by app/src/services/platform/platform.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PlatformSettings {
    readonly id: string;
    readonly scheduler_enabled: boolean;
    readonly maintenance_window_enabled: boolean;
    readonly maintenance_window_start?: string;
    readonly maintenance_window_end?: string;
    readonly webhook: IntegrationChannelConfig;
    readonly slack: IntegrationChannelConfig;
    readonly spreadsheet: IntegrationChannelConfig;
    readonly task_system: IntegrationChannelConfig;
    readonly email_digest: EmailDigestConfig;
    readonly updated_at?: string;
}

/**
 * Documents the SchedulerSummary type contract used by app/src/services/platform/platform.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface SchedulerSummary {
    readonly scheduler_enabled: boolean;
    readonly maintenance_window_active: boolean;
    readonly maintenance_window_enabled: boolean;
    readonly running_properties: number;
    readonly due_properties: number;
    readonly tracked_properties: number;
    readonly paused_properties: number;
    readonly queue_depth: number;
    readonly runs_last_24_hours: number;
    readonly failures_last_24_hours: number;
    readonly success_rate: number;
    readonly last_updated_at: string;
}

/**
 * Documents the IntegrationDeliveryLog type contract used by app/src/services/platform/platform.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface IntegrationDeliveryLog {
    readonly id: string;
    readonly channel: string;
    readonly event_type: string;
    readonly target?: string;
    readonly status: string;
    readonly attempt_count: number;
    readonly payload?: Record<string, unknown> | string;
    readonly response_status?: number;
    readonly error_message?: string;
    readonly delivered_at?: string;
    readonly created_at: string;
}
