import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

const STORAGE_KEY = "home-searcher-theme";

type ResolvedTheme = "dark" | "light";
export type ThemePreference = ResolvedTheme | "system";

interface ThemeContextValue {
    readonly preference: ThemePreference;
    readonly resolvedTheme: ResolvedTheme;
    setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isThemePreference = (value: string | null): value is ThemePreference => {
    return value === "light" || value === "dark" || value === "system";
};

const getSystemTheme = (): ResolvedTheme => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const getStoredPreference = (): ThemePreference => {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    return isThemePreference(storedValue) ? storedValue : "system";
};

const applyThemePreference = (preference: ThemePreference): void => {
    const root = document.documentElement;
    if (preference === "system") {
        root.removeAttribute("data-theme");
        window.localStorage.setItem(STORAGE_KEY, preference);
        return;
    }

    root.dataset.theme = preference;
    window.localStorage.setItem(STORAGE_KEY, preference);
};

/**
 * Provides light, dark, and system theme state for the entire app shell.
 *
 * @param props The application subtree.
 * @returns The themed provider wrapper.
 */
export const ThemeProvider = ({ children }: PropsWithChildren): JSX.Element => {
    const [preference, setPreference] = useState<ThemePreference>(() => {
        return getStoredPreference();
    });
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
        return preference === "system" ? getSystemTheme() : preference;
    });

    useEffect(() => {
        applyThemePreference(preference);
        setResolvedTheme(preference === "system" ? getSystemTheme() : preference);

        if (preference !== "system") {
            return undefined;
        }

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (event: MediaQueryListEvent): void => {
            setResolvedTheme(event.matches ? "dark" : "light");
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => {
            mediaQuery.removeEventListener("change", handleChange);
        };
    }, [preference]);

    const value = useMemo<ThemeContextValue>(() => ({
        preference,
        resolvedTheme,
        setPreference,
    }), [preference, resolvedTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/**
 * Reads and updates the current application theme preference.
 *
 * @returns The active theme context.
 */
export const useTheme = (): ThemeContextValue => {
    const context = useContext(ThemeContext);
    if (context === null) {
        throw new Error("useTheme must be used within ThemeProvider.");
    }

    return context;
};
