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
            name: "home-searcher.session",
            partialize: (state) => ({ expiresAt: state.expiresAt, token: state.token }),
        },
    ),
);