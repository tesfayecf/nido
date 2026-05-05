/**
 * File: app/src/services/auth/auth.service.ts
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
 * - Imports: @/lib/api/client
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
 *
 * Dependencies:
 * - @/lib/api/client
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
import { apiRequest, type ItemEnvelope, type StatusEnvelope } from "@/lib/api/client";

import type {
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    MeResponse,
    UpdateProfileRequest,
} from "@/services/auth/auth.types";

/**
 * Executes the backend login flow.
 *
 * @param request The user credentials.
 * @returns The issued bearer token, expiry, and user snapshot.
 */
export const login = (request: LoginRequest): Promise<LoginResponse> => {
    return apiRequest<LoginResponse, LoginRequest>({
        body: request,
        method: "POST",
        path: "/api/v1/auth/login",
    });
};

/**
 * Loads the current authenticated user.
 *
 * @returns The current user payload.
 */
export const getCurrentUser = async (): Promise<MeResponse["user"]> => {
    const response = await apiRequest<MeResponse>({
        auth: true,
        path: "/api/v1/auth/me",
    });

    return response.user;
};

/**
 * Revokes the current backend session.
 */
export const logout = async (): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "POST",
        path: "/api/v1/auth/logout",
    });
};

/**
 * Updates the current user's profile fields (display name).
 *
 * @param request The fields to update.
 * @returns The updated user payload.
 */
export const updateProfile = async (request: UpdateProfileRequest): Promise<MeResponse["user"]> => {
    const response = await apiRequest<ItemEnvelope<MeResponse["user"]>, UpdateProfileRequest>({
        auth: true,
        body: request,
        method: "PUT",
        path: "/api/v1/auth/me",
    });

    return response.item;
};

/**
 * Changes the current user's password.
 *
 * @param request Current and new password values.
 */
export const changePassword = async (request: ChangePasswordRequest): Promise<void> => {
    await apiRequest<StatusEnvelope, ChangePasswordRequest>({
        auth: true,
        body: request,
        method: "POST",
        path: "/api/v1/auth/me/password",
    });
};