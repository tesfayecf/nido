import { apiRequest, type StatusEnvelope } from "@/lib/api/client";

import type { LoginRequest, LoginResponse, MeResponse } from "@/services/auth/auth.types";

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