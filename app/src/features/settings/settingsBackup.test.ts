import { describe, expect, it } from "vitest";

import { DEFAULT_WORKSPACE_SETTINGS } from "@/features/settings/workspaceSettings";
import { FULL_SETTINGS_BACKUP_VERSION, LEGACY_SETTINGS_BACKUP_VERSION, parseImportedBackup } from "@/features/settings/settingsBackup";

describe("parseImportedBackup", () => {
    it("migrates a legacy settings backup into the local-settings shape", () => {
        const parsed = parseImportedBackup({
            notification_preferences: {
                channels: ["email"],
                digestMode: false,
                mutedTagIds: ["tag_1"],
                quietHoursEnd: "06:00",
                quietHoursStart: "23:00",
                severityFloor: "high",
            },
            theme_preference: "dark",
            version: LEGACY_SETTINGS_BACKUP_VERSION,
            workspace_settings: {
                ...DEFAULT_WORKSPACE_SETTINGS,
                preferences: {
                    ...DEFAULT_WORKSPACE_SETTINGS.preferences,
                    display_currency: "USD",
                },
            },
        });

        expect(parsed).toEqual({
            kind: "legacy-settings",
            local_settings: {
                notification_preferences: {
                    channels: ["email"],
                    digestMode: false,
                    mutedTagIds: ["tag_1"],
                    quietHoursEnd: "06:00",
                    quietHoursStart: "23:00",
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
        });
    });

    it("accepts a full workspace backup only when the versioned workspace payload is present", () => {
        const parsed = parseImportedBackup({
            exported_at: "2026-04-28T18:31:37.329Z",
            local_settings: {
                notification_preferences: {
                    channels: ["chat"],
                    digestMode: false,
                    mutedTagIds: [],
                    quietHoursEnd: "06:30",
                    quietHoursStart: "22:30",
                    severityFloor: "critical",
                },
                theme_preference: "light",
                workspace_settings: DEFAULT_WORKSPACE_SETTINGS,
            },
            version: FULL_SETTINGS_BACKUP_VERSION,
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
        });

        expect(parsed).toMatchObject({
            kind: "full",
            workspace_data: {
                schema_version: 1,
            },
        });
    });
});
