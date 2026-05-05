/**
 * File: app/src/services/backup/backup.service.ts
 *
 * Purpose:
 * Defines the backup frontend API contract, request helpers, query keys, or shared service types.
 *
 * Responsibilities:
 * - Describe typed request and response boundaries
 * - Centralize API paths, query keys, or service helpers
 * - Keep backend integration details out of rendering components
 *
 * Inputs:
 * - Imports: @/lib/api/client, @/services/backup/backup.types
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
 *
 * Dependencies:
 * - @/lib/api/client
 * - @/services/backup/backup.types
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
 * - /docs/frontend/architecture-overview.md#api-contracts
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { apiRequest, type ItemEnvelope, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";
import type { BackupFileInfo, MigrationStatus, WorkspaceDataBackup } from "@/services/backup/backup.types";

/**
 * Purpose: Executes the downloadWorkspaceBackupData operation for app/src/services/backup/backup.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const downloadWorkspaceBackupData = async (): Promise<WorkspaceDataBackup> => {
    const response = await apiRequest<ItemEnvelope<WorkspaceDataBackup>>({
        auth: true,
        path: "/api/v1/backoffice/platform/backup",
    });
    return response.item;
};

/**
 * Purpose: Executes the restoreWorkspaceBackupData operation for app/src/services/backup/backup.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const restoreWorkspaceBackupData = async (backup: WorkspaceDataBackup): Promise<void> => {
    await apiRequest<StatusEnvelope, WorkspaceDataBackup>({
        auth: true,
        body: backup,
        method: "POST",
        path: "/api/v1/backoffice/platform/restore",
    });
};

/**
 * Purpose: Executes the createWorkspaceBackupFile operation for app/src/services/backup/backup.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const createWorkspaceBackupFile = async (): Promise<BackupFileInfo> => {
    const response = await apiRequest<ItemEnvelope<BackupFileInfo>>({
        auth: true,
        method: "POST",
        path: "/api/v1/backoffice/platform/backup-files",
    });
    return response.item;
};

/**
 * Purpose: Executes the listWorkspaceBackupFiles operation for app/src/services/backup/backup.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const listWorkspaceBackupFiles = async (): Promise<BackupFileInfo[]> => {
    const response = await apiRequest<ListEnvelope<BackupFileInfo>>({
        auth: true,
        path: "/api/v1/backoffice/platform/backup-files",
    });
    return response.items;
};

/**
 * Purpose: Executes the resetWorkspaceData operation for app/src/services/backup/backup.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const resetWorkspaceData = async (): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "POST",
        path: "/api/v1/backoffice/platform/reset",
    });
};

/**
 * Purpose: Executes the getMigrationStatus operation for app/src/services/backup/backup.service.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const getMigrationStatus = async (): Promise<MigrationStatus> => {
    const response = await apiRequest<ItemEnvelope<MigrationStatus>>({
        path: "/api/v1/platform/migration/status",
    });
    return response.item;
};
