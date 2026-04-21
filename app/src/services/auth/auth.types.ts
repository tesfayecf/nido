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