/**
 * File: app/src/services/auth/auth.types.ts
 *
 * Purpose:
 * Defines the auth frontend API contract, request helpers, query keys, or shared service types.
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
 * Mirrors the backend user payload.
 */
export interface AuthUser {
    readonly created_at: string;
    readonly display_name: string;
    readonly email: string;
    readonly id: string;
    readonly updated_at: string;
}

/**
 * Describes the login request body.
 */
export interface LoginRequest {
    readonly email: string;
    readonly password: string;
}

/**
 * Mirrors the backend login response.
 */
export interface LoginResponse {
    readonly expires_at: string;
    readonly token: string;
    readonly user: AuthUser;
}

/**
 * Mirrors the backend auth me response.
 */
export interface MeResponse {
    readonly user: AuthUser;
}

/**
 * Describes the update-profile request body.
 */
export interface UpdateProfileRequest {
    readonly display_name: string;
}

/**
 * Describes the change-password request body.
 */
export interface ChangePasswordRequest {
    readonly current_password: string;
    readonly new_password: string;
}