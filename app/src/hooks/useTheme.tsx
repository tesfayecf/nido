import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

export const THEME_STORAGE_KEY = "home-searcher-theme";

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

const resolveTheme = (preference: ThemePreference): ResolvedTheme => {
    return preference === "system" ? getSystemTheme() : preference;
};

export const getStoredThemePreference = (): ThemePreference => {
    const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(storedValue) ? storedValue : "system";
};

export const applyThemePreference = (preference: ThemePreference): ResolvedTheme => {
    const resolvedTheme = resolveTheme(preference);
    document.documentElement.dataset.theme = resolvedTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    return resolvedTheme;
};

/**
 * Provides light, dark, and system theme state for the entire app shell.
 *
 * @param props The application subtree.
 * @returns The themed provider wrapper.
 */
export const ThemeProvider = ({ children }: PropsWithChildren): JSX.Element => {
    const [preference, setPreference] = useState<ThemePreference>(() => {
        return getStoredThemePreference();
    });
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
        return resolveTheme(preference);
    });

    useEffect(() => {
        setResolvedTheme(applyThemePreference(preference));

        if (preference !== "system") {
            return undefined;
        }

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (): void => {
            setResolvedTheme(applyThemePreference("system"));
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
