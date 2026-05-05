/**
 * File: app/src/services/fields/fields.types.ts
 *
 * Purpose:
 * Defines the fields frontend API contract, request helpers, query keys, or shared service types.
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
export type FieldDataType = "number" | "string" | "boolean" | "enum";

/**
 * Documents the FieldDefinition type contract used by app/src/services/fields/fields.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface FieldDefinition {
    readonly id: string;
    readonly name: string;
    readonly display_name: string;
    readonly data_type: FieldDataType;
    readonly unit?: string;
    readonly description?: string;
    readonly enum_values?: string[];
    readonly default_value?: string;
    readonly use_default_when_missing?: boolean;
    readonly comparison_operator?: "" | "eq" | "gt" | "lt" | "contains";
    readonly comparison_value?: string;
    readonly system_defined: boolean;
    readonly created_at: string;
    readonly updated_at: string;
}

/**
 * Documents the FieldDefinitionUsage type contract used by app/src/services/fields/fields.types.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface FieldDefinitionUsage extends FieldDefinition {
    readonly properties_using: number;
    readonly value_count: number;
}
