/**
 * File: app/src/stores/session.store.ts
 *
 * Purpose:
 * Defines shared client-side state boundaries used across routes and shell-level interactions.
 *
 * Responsibilities:
 * - Define the store shape and mutation actions
 * - Keep cross-route state explicit and serializable where possible
 * - Provide stable selectors or actions for consuming components
 *
 * Inputs:
 * - Imports: zustand, zustand/middleware
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - zustand
 * - zustand/middleware
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
 * - /app/docs/state-management.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Describes the persisted auth session snapshot.
 */
interface SessionState {
    readonly expiresAt: string | null;
    readonly token: string | null;
    clearSession: () => void;
    setSession: (session: { expiresAt: string; token: string; }) => void;
}

/**
 * Stores the frontend bearer session state.
 */
export const useSessionStore = create<SessionState>()(
    persist(
        (set) => ({
            expiresAt: null,
            token: null,
            clearSession: () => {
                set({ expiresAt: null, token: null });
            },
            setSession: ({ expiresAt, token }) => {
                set({ expiresAt, token });
            },
        }),
        {
            name: "nido.session",
            partialize: (state) => ({ expiresAt: state.expiresAt, token: state.token }),
        },
    ),
);