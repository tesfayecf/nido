import { apiRequest, type ItemEnvelope, type StatusEnvelope } from "@/lib/api/client";
import type { WorkspaceDataBackup } from "@/services/backup/backup.types";

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
