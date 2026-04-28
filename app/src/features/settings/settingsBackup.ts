import type { ThemePreference } from "@/hooks/useTheme";
import type { WorkspaceDataBackup } from "@/services/backup/backup.types";

import { normalizeWorkspaceSettings, type WorkspaceSettings } from "@/features/settings/workspaceSettings";

export interface NotificationPreferencesDraft {
    readonly channels: string[];
    readonly digestMode: boolean;
    readonly mutedTagIds: string[];
    readonly quietHoursEnd: string;
    readonly quietHoursStart: string;
    readonly severityFloor: string;
}

export interface LocalSettingsBackupData {
    readonly notification_preferences: NotificationPreferencesDraft;
    readonly theme_preference: ThemePreference;
    readonly workspace_settings: WorkspaceSettings;
}

export interface WorkspaceBackupFile {
    readonly exported_at: string;
    readonly local_settings: LocalSettingsBackupData;
    readonly version: 2;
    readonly workspace_data: WorkspaceDataBackup;
}

export interface LegacySettingsBackupData {
    readonly exported_at: string;
    readonly notification_preferences: NotificationPreferencesDraft;
    readonly theme_preference: ThemePreference;
    readonly version: 1;
    readonly workspace_settings: WorkspaceSettings;
}

export type ImportedBackup = {
    readonly kind: "full";
    readonly local_settings: LocalSettingsBackupData;
    readonly workspace_data: WorkspaceDataBackup;
} | {
    readonly kind: "legacy-settings";
    readonly local_settings: LocalSettingsBackupData;
};

export const LEGACY_SETTINGS_BACKUP_VERSION = 1;
export const FULL_SETTINGS_BACKUP_VERSION = 2;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesDraft = {
    channels: ["in-app", "email"],
    digestMode: true,
    mutedTagIds: [],
    quietHoursEnd: "07:00",
    quietHoursStart: "22:00",
    severityFloor: "medium",
};

const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
};

const readStringArray = (value: unknown, fallback: readonly string[]): string[] => {
    return Array.isArray(value)
        ? value.map((item) => `${item}`.trim()).filter((item) => item !== "")
        : [...fallback];
};

export const normalizeNotificationPreferences = (value: unknown): NotificationPreferencesDraft => {
    if (!isObject(value)) {
        return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    return {
        channels: readStringArray(value.channels, DEFAULT_NOTIFICATION_PREFERENCES.channels),
        digestMode: typeof value.digestMode === "boolean" ? value.digestMode : DEFAULT_NOTIFICATION_PREFERENCES.digestMode,
        mutedTagIds: readStringArray(value.mutedTagIds, DEFAULT_NOTIFICATION_PREFERENCES.mutedTagIds),
        quietHoursEnd: typeof value.quietHoursEnd === "string" ? value.quietHoursEnd : DEFAULT_NOTIFICATION_PREFERENCES.quietHoursEnd,
        quietHoursStart: typeof value.quietHoursStart === "string" ? value.quietHoursStart : DEFAULT_NOTIFICATION_PREFERENCES.quietHoursStart,
        severityFloor: typeof value.severityFloor === "string" ? value.severityFloor : DEFAULT_NOTIFICATION_PREFERENCES.severityFloor,
    };
};

export const normalizeThemePreference = (value: unknown): ThemePreference => {
    return value === "dark" || value === "light" || value === "system" ? value : "system";
};

const normalizeLocalSettingsBackup = (value: unknown): LocalSettingsBackupData | null => {
    if (!isObject(value)) {
        return null;
    }

    return {
        notification_preferences: normalizeNotificationPreferences(value.notification_preferences),
        theme_preference: normalizeThemePreference(value.theme_preference),
        workspace_settings: normalizeWorkspaceSettings(value.workspace_settings),
    };
};

const readArray = <T>(value: unknown): T[] => {
    return Array.isArray(value) ? value as T[] : [];
};

const normalizeWorkspaceDataBackup = (value: unknown): WorkspaceDataBackup | null => {
    if (!isObject(value) || !isObject(value.platform_settings) || typeof value.schema_version !== "number") {
        return null;
    }

    return {
        field_definitions: readArray(value.field_definitions),
        platform_settings: value.platform_settings as unknown as WorkspaceDataBackup["platform_settings"],
        properties: readArray(value.properties),
        property_configs: readArray(value.property_configs),
        property_field_values: readArray(value.property_field_values),
        property_runs: readArray(value.property_runs),
        property_snapshots: readArray(value.property_snapshots),
        property_tags: readArray(value.property_tags),
        schema_version: value.schema_version,
        sources: readArray(value.sources),
        tags: readArray(value.tags),
    };
};

export const buildWorkspaceBackupFile = (
    localSettings: LocalSettingsBackupData,
    workspaceData: WorkspaceDataBackup,
): WorkspaceBackupFile => ({
    exported_at: new Date().toISOString(),
    local_settings: localSettings,
    version: FULL_SETTINGS_BACKUP_VERSION,
    workspace_data: workspaceData,
});

export const parseImportedBackup = (value: unknown): ImportedBackup | null => {
    if (!isObject(value)) {
        return null;
    }

    if (value.version === FULL_SETTINGS_BACKUP_VERSION) {
        const localSettings = normalizeLocalSettingsBackup(value.local_settings);
        const workspaceData = normalizeWorkspaceDataBackup(value.workspace_data);
        if (localSettings === null || workspaceData === null) {
            return null;
        }

        return {
            kind: "full",
            local_settings: localSettings,
            workspace_data: workspaceData,
        };
    }

    if (value.version === LEGACY_SETTINGS_BACKUP_VERSION) {
        return {
            kind: "legacy-settings",
            local_settings: {
                notification_preferences: normalizeNotificationPreferences(value.notification_preferences),
                theme_preference: normalizeThemePreference(value.theme_preference),
                workspace_settings: normalizeWorkspaceSettings(value.workspace_settings),
            },
        };
    }

    return null;
};
