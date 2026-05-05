/**
 * File: app/src/features/settings/settingsBackup.ts
 *
 * Purpose:
 * Implements the settings feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Define typed frontend behavior for its module boundary
 * - Keep inputs and outputs explicit for maintainability
 * - Reference related modules so changes can be traced safely
 *
 * Inputs:
 * - Imports: @/hooks/useTheme, @/services/backup/backup.types, @/features/settings/workspaceSettings
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - @/hooks/useTheme
 * - @/services/backup/backup.types
 * - @/features/settings/workspaceSettings
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
 * - /app/docs/features/settings.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import type { ThemePreference } from "@/hooks/useTheme";
import type { WorkspaceDataBackup } from "@/services/backup/backup.types";

import { normalizeWorkspaceSettings, type WorkspaceSettings } from "@/features/settings/workspaceSettings";

/**
 * Documents the NotificationPreferencesDraft type contract used by app/src/features/settings/settingsBackup.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface NotificationPreferencesDraft {
    readonly channels: string[];
    readonly digestMode: boolean;
    readonly mutedTagIds: string[];
    readonly quietHoursEnd: string;
    readonly quietHoursStart: string;
    readonly severityFloor: string;
}

/**
 * Documents the LocalSettingsBackupData type contract used by app/src/features/settings/settingsBackup.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface LocalSettingsBackupData {
    readonly notification_preferences: NotificationPreferencesDraft;
    readonly theme_preference: ThemePreference;
    readonly workspace_settings: WorkspaceSettings;
}

/**
 * Documents the WorkspaceBackupFile type contract used by app/src/features/settings/settingsBackup.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface WorkspaceBackupFile {
    readonly exported_at: string;
    readonly local_settings: LocalSettingsBackupData;
    readonly version: 2;
    readonly workspace_data: WorkspaceDataBackup;
}

/**
 * Documents the LegacySettingsBackupData type contract used by app/src/features/settings/settingsBackup.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface LegacySettingsBackupData {
    readonly exported_at: string;
    readonly notification_preferences: NotificationPreferencesDraft;
    readonly theme_preference: ThemePreference;
    readonly version: 1;
    readonly workspace_settings: WorkspaceSettings;
}

/**
 * Documents the ImportedBackup type contract used by app/src/features/settings/settingsBackup.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export type ImportedBackup = {
    readonly kind: "full";
    readonly local_settings: LocalSettingsBackupData;
    readonly workspace_data: WorkspaceDataBackup;
} | {
    readonly kind: "legacy-settings";
    readonly local_settings: LocalSettingsBackupData;
};

/**
 * Documents the LEGACY_SETTINGS_BACKUP_VERSION module export for app/src/features/settings/settingsBackup.ts.
 * Consumers should treat this export as part of the file contract and update related docs when behavior changes.
 */
export const LEGACY_SETTINGS_BACKUP_VERSION = 1;
/**
 * Documents the FULL_SETTINGS_BACKUP_VERSION module export for app/src/features/settings/settingsBackup.ts.
 * Consumers should treat this export as part of the file contract and update related docs when behavior changes.
 */
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

/**
 * Purpose: Executes the normalizeNotificationPreferences operation for app/src/features/settings/settingsBackup.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
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

/**
 * Purpose: Executes the normalizeThemePreference operation for app/src/features/settings/settingsBackup.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
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

/**
 * Purpose: Executes the buildWorkspaceBackupFile operation for app/src/features/settings/settingsBackup.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const buildWorkspaceBackupFile = (
    localSettings: LocalSettingsBackupData,
    workspaceData: WorkspaceDataBackup,
): WorkspaceBackupFile => ({
    exported_at: new Date().toISOString(),
    local_settings: localSettings,
    version: FULL_SETTINGS_BACKUP_VERSION,
    workspace_data: workspaceData,
});

/**
 * Purpose: Executes the parseImportedBackup operation for app/src/features/settings/settingsBackup.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
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
