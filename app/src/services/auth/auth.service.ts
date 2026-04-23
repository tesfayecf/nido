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