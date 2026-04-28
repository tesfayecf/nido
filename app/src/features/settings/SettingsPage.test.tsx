import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { DEFAULT_WORKSPACE_SETTINGS, WORKSPACE_SETTINGS_STORAGE_KEY } from "@/features/settings/workspaceSettings";
import { ThemeProvider, THEME_STORAGE_KEY } from "@/hooks/useTheme";

const PREFERENCE_STORAGE_KEY = "nido.notification-preferences";
const getCurrentUserMock = vi.fn();
const listSourcesMock = vi.fn();
const listTagsMock = vi.fn();

vi.mock("@/services/auth/auth.service", () => ({
    changePassword: vi.fn(),
    getCurrentUser: () => getCurrentUserMock(),
    updateProfile: vi.fn(),
}));

vi.mock("@/services/backoffice-sources/sources.service", () => ({
    listSources: () => listSourcesMock(),
}));

vi.mock("@/services/tags/tags.service", () => ({
    listTags: () => listTagsMock(),
}));

const renderSettingsPage = (): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <ToastProvider>
                    <SettingsPage />
                </ToastProvider>
            </ThemeProvider>
        </QueryClientProvider>,
    );
};

describe("SettingsPage", () => {
    beforeEach(() => {
        window.localStorage.clear();
        getCurrentUserMock.mockReset();
        listSourcesMock.mockReset();
        listTagsMock.mockReset();
        getCurrentUserMock.mockResolvedValue({ display_name: "Alex", email: "alex@example.com", id: "user_1" });
        listSourcesMock.mockResolvedValue([]);
        listTagsMock.mockResolvedValue([]);

        if (!window.matchMedia) {
            Object.defineProperty(window, "matchMedia", {
                value: vi.fn().mockImplementation(() => ({
                    addEventListener: vi.fn(),
                    matches: false,
                    removeEventListener: vi.fn(),
                })),
                writable: true,
            });
        }
    });

    it("labels export, recovery, and reset actions clearly in the data movement tab", async () => {
        renderSettingsPage();

        fireEvent.click(screen.getByRole("tab", { name: "Recovery & Data Movement" }));

        expect(await screen.findByText("Export local settings")).toBeInTheDocument();
        expect(screen.getByText("Recover from backup")).toBeInTheDocument();
        expect(screen.getAllByText("Reset local settings").length).toBeGreaterThan(0);
        expect(screen.getByText("Download a JSON backup of local settings, notification preferences, and the current theme.")).toBeInTheDocument();
    });

    it("restores local settings from a backup file after confirmation", async () => {
        renderSettingsPage();
        fireEvent.click(screen.getByRole("tab", { name: "Recovery & Data Movement" }));

        const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
        expect(fileInput).not.toBeNull();

        const backup = {
            exported_at: "2026-04-28T18:31:37.329Z",
            notification_preferences: {
                channels: ["email"],
                digestMode: false,
                mutedTagIds: ["tag_1"],
                quietHoursEnd: "08:00",
                quietHoursStart: "21:00",
                severityFloor: "high",
            },
            theme_preference: "dark",
            version: 1,
            workspace_settings: {
                ...DEFAULT_WORKSPACE_SETTINGS,
                preferences: {
                    ...DEFAULT_WORKSPACE_SETTINGS.preferences,
                    display_currency: "USD",
                },
            },
        };

        const backupFile = new File([JSON.stringify(backup)], "settings-backup.json", { type: "application/json" });
        Object.defineProperty(backupFile, "text", {
            configurable: true,
            value: vi.fn().mockResolvedValue(JSON.stringify(backup)),
        });
        Object.defineProperty(fileInput as HTMLInputElement, "files", {
            configurable: true,
            value: [backupFile],
        });
        fireEvent.change(fileInput as HTMLInputElement);

        expect(await screen.findByText("Restore settings backup")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));

        await waitFor(() => {
            expect(window.localStorage.getItem(PREFERENCE_STORAGE_KEY)).toContain('"severityFloor":"high"');
            expect(window.localStorage.getItem(WORKSPACE_SETTINGS_STORAGE_KEY)).toContain('"display_currency":"USD"');
            expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
        });
    });

    it("resets local settings and clears saved UI state only after confirmation", async () => {
        window.localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify({
            channels: ["email"],
            digestMode: false,
            mutedTagIds: [],
            quietHoursEnd: "08:00",
            quietHoursStart: "21:00",
            severityFloor: "critical",
        }));
        window.localStorage.setItem(WORKSPACE_SETTINGS_STORAGE_KEY, JSON.stringify({
            ...DEFAULT_WORKSPACE_SETTINGS,
            preferences: {
                ...DEFAULT_WORKSPACE_SETTINGS.preferences,
                display_locale: "es-ES",
            },
        }));
        window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
        window.localStorage.setItem("nido.bookmark-groups", JSON.stringify({ groups: ["Priority"] }));
        window.localStorage.setItem("nido.nav-collapsed", "true");
        window.localStorage.setItem("nido.properties.table", JSON.stringify({ columns: [] }));

        renderSettingsPage();
        fireEvent.click(screen.getByRole("tab", { name: "Recovery & Data Movement" }));
        fireEvent.click(await screen.findByRole("button", { name: "Reset local settings" }));
        fireEvent.click(screen.getAllByRole("button", { name: "Reset local settings" }).at(-1) as HTMLElement);

        await waitFor(() => {
            expect(window.localStorage.getItem(WORKSPACE_SETTINGS_STORAGE_KEY)).toBeNull();
            expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
            expect(window.localStorage.getItem("nido.bookmark-groups")).toBeNull();
            expect(window.localStorage.getItem("nido.nav-collapsed")).toBeNull();
            expect(window.localStorage.getItem("nido.properties.table")).toBeNull();
        });
    });
});
