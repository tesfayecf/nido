/**
 * File: app/src/features/settings/localPreferences.ts
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
 * - Imports: @/features/settings/settingsBackup
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
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
import { DEFAULT_NOTIFICATION_PREFERENCES, normalizeNotificationPreferences } from "@/features/settings/settingsBackup";

/**
 * Documents the PREFERENCE_STORAGE_KEY module export for app/src/features/settings/localPreferences.ts.
 * Consumers should treat this export as part of the file contract and update related docs when behavior changes.
 */
export const PREFERENCE_STORAGE_KEY = "nido.notification-preferences";
/**
 * Documents the WEEKLY_DIGEST_STORAGE_KEY module export for app/src/features/settings/localPreferences.ts.
 * Consumers should treat this export as part of the file contract and update related docs when behavior changes.
 */
export const WEEKLY_DIGEST_STORAGE_KEY = "nido.weekly-digest";

/**
 * Purpose: Executes the readNotificationPreferences operation for app/src/features/settings/localPreferences.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const readNotificationPreferences = (): typeof DEFAULT_NOTIFICATION_PREFERENCES => {
    if (typeof window === "undefined") {
        return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    try {
        return normalizeNotificationPreferences(JSON.parse(window.localStorage.getItem(PREFERENCE_STORAGE_KEY) ?? "null"));
    } catch {
        return DEFAULT_NOTIFICATION_PREFERENCES;
    }
};
