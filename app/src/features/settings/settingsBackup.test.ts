/**
 * File: app/src/features/settings/settingsBackup.test.ts
 *
 * Purpose:
 * Validates the documented behavior of settingsBackup and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: vitest, @/features/settings/workspaceSettings, @/features/settings/settingsBackup
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - vitest
 * - @/features/settings/workspaceSettings
 * - @/features/settings/settingsBackup
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
