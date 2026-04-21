import { create } from "zustand";

/**
 * Describes shell-scoped UI state.
 */
interface ShellState {
    readonly liveRailOpen: boolean;
    readonly navOpen: boolean;
    setLiveRailOpen: (next: boolean) => void;
    setNavOpen: (next: boolean) => void;
}

/**
 * Stores lightweight client-only shell state.
 */
export const useShellStore = create<ShellState>((set) => ({
    liveRailOpen: true,
    navOpen: true,
    setLiveRailOpen: (next: boolean) => {
        set({ liveRailOpen: next });
    },
    setNavOpen: (next: boolean) => {
        set({ navOpen: next });
    },
}));