/**
 * Mirrors the backend user payload.
 */
export interface AuthUser {
    readonly created_at: string;
    readonly display_name: string;
    readonly email: string;
    readonly id: string;
    readonly role: "admin" | "operator" | "viewer";
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

export interface UsersResponse {
    readonly count: number;
    readonly items: AuthUser[];
}

export interface CreateUserRequest {
    readonly display_name: string;
    readonly email: string;
    readonly password: string;
    readonly role: AuthUser["role"];
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
