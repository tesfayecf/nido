/**
 * File: app/src/services/properties/properties.keys.ts
 *
 * Purpose:
 * Defines the properties frontend API contract, request helpers, query keys, or shared service types.
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
/**
 * Defines stable query keys for property data.
 */
export const propertyKeys = {
    all: () => ["properties"] as const,
    config: (propertyId: string) => ["properties", "config", propertyId] as const,
    configVersion: (propertyId: string, version: number) => ["properties", "config", propertyId, version] as const,
    configVersions: (propertyId: string) => ["properties", "config-versions", propertyId] as const,
    detail: (propertyId: string) => ["properties", "detail", propertyId] as const,
    list: () => ["properties", "list"] as const,
    runs: (propertyId: string) => ["properties", "runs", propertyId] as const,
    snapshots: (propertyId: string) => ["properties", "snapshots", propertyId] as const,
    summary: (propertyId: string) => ["properties", "summary", propertyId] as const,
    summaries: () => ["properties", "summaries"] as const,
};
