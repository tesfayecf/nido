import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { DEFAULT_WORKSPACE_SETTINGS, WORKSPACE_SETTINGS_STORAGE_KEY } from "@/features/settings/workspaceSettings";
import { ThemeProvider, THEME_STORAGE_KEY } from "@/hooks/useTheme";

const PREFERENCE_STORAGE_KEY = "nido.notification-preferences";
const downloadWorkspaceBackupDataMock = vi.fn();
const restoreWorkspaceBackupDataMock = vi.fn();
const createWorkspaceBackupFileMock = vi.fn();
const getMigrationStatusMock = vi.fn();
const listWorkspaceBackupFilesMock = vi.fn();
const resetWorkspaceDataMock = vi.fn();
const getCurrentUserMock = vi.fn();
const listSourcesMock = vi.fn();
const listTagsMock = vi.fn();

vi.mock("@/services/backup/backup.service", () => ({
    createWorkspaceBackupFile: () => createWorkspaceBackupFileMock(),
    downloadWorkspaceBackupData: () => downloadWorkspaceBackupDataMock(),
    getMigrationStatus: () => getMigrationStatusMock(),
    listWorkspaceBackupFiles: () => listWorkspaceBackupFilesMock(),
    resetWorkspaceData: () => resetWorkspaceDataMock(),
    restoreWorkspaceBackupData: (backup: unknown) => restoreWorkspaceBackupDataMock(backup),
}));

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

const TEST_TIMEOUT_MS = 30000;

describe("SettingsPage", () => {
    beforeEach(() => {
        window.localStorage.clear();
        downloadWorkspaceBackupDataMock.mockReset();
        restoreWorkspaceBackupDataMock.mockReset();
        createWorkspaceBackupFileMock.mockReset();
        getMigrationStatusMock.mockReset();
        listWorkspaceBackupFilesMock.mockReset();
        resetWorkspaceDataMock.mockReset();
        getCurrentUserMock.mockReset();
        listSourcesMock.mockReset();
        listTagsMock.mockReset();
        getCurrentUserMock.mockResolvedValue({ display_name: "Alex", email: "alex@example.com", id: "user_1" });
        listSourcesMock.mockResolvedValue([]);
        listTagsMock.mockResolvedValue([]);
        createWorkspaceBackupFileMock.mockResolvedValue({ created_at: "2026-05-03T10:00:00Z", name: "workspace_2026-05-03T10-00-00_v1.json", path: "/app/backups/workspace_2026-05-03T10-00-00_v1.json", size_bytes: 128 });
        getMigrationStatusMock.mockResolvedValue({ current_version: 12, pending: false, state: "ready", strategy: "safe-auto", target_version: 12 });
        listWorkspaceBackupFilesMock.mockResolvedValue([]);
        resetWorkspaceDataMock.mockResolvedValue(undefined);

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

    it("labels download, upload, overwrite strategy, and reset actions clearly in the data movement tab", async () => {
        renderSettingsPage();

        fireEvent.click(screen.getByRole("tab", { name: "Recovery & Data Movement" }));

        expect(await screen.findByRole("heading", { name: "Download backup" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Server backup storage" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Upload backup" })).toBeInTheDocument();
        expect(screen.getByText("Conflict strategy")).toBeInTheDocument();
        expect(screen.getAllByText("Reset local settings").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Reset application").length).toBeGreaterThan(0);
        expect(screen.getByText("Export properties, sources, tags, relationships, field definitions, platform settings, and this device’s local settings into one versioned JSON file.")).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);

    it("surfaces a settings snapshot before the tab panels", async () => {
        renderSettingsPage();

        const profile = await screen.findByText("Profile");
        const snapshot = profile.closest("section");

        expect(snapshot).not.toBeNull();
        expect(snapshot).toHaveAttribute("aria-label", "Settings snapshot");
        expect(within(snapshot as HTMLElement).getByText("Workspace view")).toBeInTheDocument();
        expect(within(snapshot as HTMLElement).getByText("Operational defaults")).toBeInTheDocument();
        expect(within(snapshot as HTMLElement).getByText("Recovery status")).toBeInTheDocument();
        expect(await within(snapshot as HTMLElement).findByText("Alex")).toBeInTheDocument();
        expect(await within(snapshot as HTMLElement).findByText("Ready")).toBeInTheDocument();
    }, TEST_TIMEOUT_MS);

    it("applies quick preference presets and saves them locally", async () => {
        renderSettingsPage();

        expect(await screen.findByRole("heading", { name: "Preferences" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Apply United States display preset" }));
        fireEvent.click(screen.getByRole("button", { name: "Compact" }));
        fireEvent.click(screen.getByRole("button", { name: "Apply all channels notification preset" }));
        fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

        await waitFor(() => {
            expect(window.localStorage.getItem(WORKSPACE_SETTINGS_STORAGE_KEY)).toContain('"display_locale":"en-US"');
            expect(window.localStorage.getItem(WORKSPACE_SETTINGS_STORAGE_KEY)).toContain('"display_currency":"USD"');
            expect(window.localStorage.getItem(WORKSPACE_SETTINGS_STORAGE_KEY)).toContain('"density":"compact"');
            expect(window.localStorage.getItem(PREFERENCE_STORAGE_KEY)).toContain('"channels":["in-app","email","webhook","chat"]');
        });
    }, TEST_TIMEOUT_MS);

    it("restores a full workspace backup after confirmation", async () => {
        restoreWorkspaceBackupDataMock.mockResolvedValue(undefined);
        renderSettingsPage();
        fireEvent.click(screen.getByRole("tab", { name: "Recovery & Data Movement" }));

        const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
        expect(fileInput).not.toBeNull();

        const backup = {
            exported_at: "2026-04-28T18:31:37.329Z",
            local_settings: {
                notification_preferences: {
                    channels: ["email"],
                    digestMode: false,
                    mutedTagIds: ["tag_1"],
                    quietHoursEnd: "08:00",
                    quietHoursStart: "21:00",
                    severityFloor: "high",
                },
                theme_preference: "dark",
                workspace_settings: {
                    ...DEFAULT_WORKSPACE_SETTINGS,
                    preferences: {
                        ...DEFAULT_WORKSPACE_SETTINGS.preferences,
                        display_currency: "USD",
                    },
                },
            },
            version: 2,
            workspace_data: {
                field_definitions: [],
                platform_settings: {
                    email_digest: { enabled: false, events: [], schedule: "09:00" },
                    id: "platform",
                    maintenance_window_enabled: false,
                    scheduler_enabled: true,
                    slack: {},
                    spreadsheet: {},
                    task_system: {},
                    webhook: {},
                },
                properties: [],
                property_configs: [],
                property_field_values: [],
                property_runs: [],
                property_snapshots: [],
                property_tags: [],
                schema_version: 1,
                sources: [],
                tags: [],
            },
        };

        const backupFile = new File([JSON.stringify(backup)], "workspace-backup.json", { type: "application/json" });
        Object.defineProperty(backupFile, "text", {
            configurable: true,
            value: vi.fn().mockResolvedValue(JSON.stringify(backup)),
        });
        Object.defineProperty(fileInput as HTMLInputElement, "files", {
            configurable: true,
            value: [backupFile],
        });
        fireEvent.change(fileInput as HTMLInputElement);

        expect(await screen.findByRole("dialog", { name: "Restore workspace backup" })).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole("button", { name: "Restore workspace backup" }).at(-1) as HTMLElement);

        await waitFor(() => {
            expect(restoreWorkspaceBackupDataMock).toHaveBeenCalledWith(backup.workspace_data);
            expect(window.localStorage.getItem(PREFERENCE_STORAGE_KEY)).toContain('"severityFloor":"high"');
            expect(window.localStorage.getItem(WORKSPACE_SETTINGS_STORAGE_KEY)).toContain('"display_currency":"USD"');
            expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
        });
    }, TEST_TIMEOUT_MS);

    it("restores a legacy settings-only backup without calling the workspace restore API", async () => {
        renderSettingsPage();
        fireEvent.click(screen.getByRole("tab", { name: "Recovery & Data Movement" }));

        const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
        expect(fileInput).not.toBeNull();

        const legacyBackup = {
            exported_at: "2026-04-28T18:31:37.329Z",
            notification_preferences: {
                channels: ["chat"],
                digestMode: false,
                mutedTagIds: ["tag_legacy"],
                quietHoursEnd: "06:30",
                quietHoursStart: "23:30",
                severityFloor: "critical",
            },
            theme_preference: "light",
            version: 1,
            workspace_settings: {
                ...DEFAULT_WORKSPACE_SETTINGS,
                preferences: {
                    ...DEFAULT_WORKSPACE_SETTINGS.preferences,
                    display_locale: "es-ES",
                },
            },
        };

        const backupFile = new File([JSON.stringify(legacyBackup)], "legacy-settings-backup.json", { type: "application/json" });
        Object.defineProperty(backupFile, "text", {
            configurable: true,
            value: vi.fn().mockResolvedValue(JSON.stringify(legacyBackup)),
        });
        Object.defineProperty(fileInput as HTMLInputElement, "files", {
            configurable: true,
            value: [backupFile],
        });
        fireEvent.change(fileInput as HTMLInputElement);

        expect(await screen.findByRole("dialog", { name: "Restore settings backup" })).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole("button", { name: "Restore settings backup" }).at(-1) as HTMLElement);

        await waitFor(() => {
            expect(restoreWorkspaceBackupDataMock).not.toHaveBeenCalled();
            expect(window.localStorage.getItem(PREFERENCE_STORAGE_KEY)).toContain('"severityFloor":"critical"');
            expect(window.localStorage.getItem(WORKSPACE_SETTINGS_STORAGE_KEY)).toContain('"display_locale":"es-ES"');
            expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
        });
    }, TEST_TIMEOUT_MS);

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
    }, TEST_TIMEOUT_MS);
});
