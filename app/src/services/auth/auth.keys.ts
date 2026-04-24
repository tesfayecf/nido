/**
 * Defines stable query keys for auth state.
 */
export const authKeys = {
    me: () => ["auth", "me"] as const,
    users: () => ["auth", "users"] as const,
};
