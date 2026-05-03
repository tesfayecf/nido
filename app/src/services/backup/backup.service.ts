import { apiRequest, type ItemEnvelope, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";
import type { BackupFileInfo, MigrationStatus, WorkspaceDataBackup } from "@/services/backup/backup.types";

export const downloadWorkspaceBackupData = async (): Promise<WorkspaceDataBackup> => {
    const response = await apiRequest<ItemEnvelope<WorkspaceDataBackup>>({
        auth: true,
        path: "/api/v1/backoffice/platform/backup",
    });
    return response.item;
};

export const restoreWorkspaceBackupData = async (backup: WorkspaceDataBackup): Promise<void> => {
    await apiRequest<StatusEnvelope, WorkspaceDataBackup>({
        auth: true,
        body: backup,
        method: "POST",
        path: "/api/v1/backoffice/platform/restore",
    });
};

export const createWorkspaceBackupFile = async (): Promise<BackupFileInfo> => {
    const response = await apiRequest<ItemEnvelope<BackupFileInfo>>({
        auth: true,
        method: "POST",
        path: "/api/v1/backoffice/platform/backup-files",
    });
    return response.item;
};

export const listWorkspaceBackupFiles = async (): Promise<BackupFileInfo[]> => {
    const response = await apiRequest<ListEnvelope<BackupFileInfo>>({
        auth: true,
        path: "/api/v1/backoffice/platform/backup-files",
    });
    return response.items;
};

export const resetWorkspaceData = async (): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "POST",
        path: "/api/v1/backoffice/platform/reset",
    });
};

export const getMigrationStatus = async (): Promise<MigrationStatus> => {
    const response = await apiRequest<ItemEnvelope<MigrationStatus>>({
        path: "/api/v1/platform/migration/status",
    });
    return response.item;
};
