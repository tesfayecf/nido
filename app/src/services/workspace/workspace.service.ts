import { apiRequest, buildApiUrl, type ItemEnvelope, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { useSessionStore } from "@/stores/session.store";

import type {
    AuditLogEntry,
    ImportPreview,
    IntegrationConfig,
    IntegrationDelivery,
    MaintenanceWindow,
    PortfolioAnalytics,
    PropertyMetadata,
    SchedulerPause,
    SystemHealth,
    WorkspaceExport,
} from "@/services/workspace/workspace.types";

const authHeaders = (): Headers => {
    const token = useSessionStore.getState().token;
    if (token === null) {
        throw new ApiError("Authentication required.", 401);
    }

    const headers = new Headers();
    headers.set("Authorization", `Bearer ${token}`);
    return headers;
};

export const getPropertyMetadata = async (propertyId: string): Promise<PropertyMetadata> => {
    const response = await apiRequest<ItemEnvelope<PropertyMetadata>>({
        auth: true,
        path: `/api/v1/backoffice/properties/${propertyId}/metadata`,
    });

    return response.item;
};

export const updatePropertyMetadata = async (propertyId: string, payload: PropertyMetadata): Promise<PropertyMetadata> => {
    const response = await apiRequest<ItemEnvelope<PropertyMetadata>, PropertyMetadata>({
        auth: true,
        body: payload,
        method: "PUT",
        path: `/api/v1/backoffice/properties/${propertyId}/metadata`,
    });

    return response.item;
};

export const listPropertyAudit = async (propertyId: string): Promise<AuditLogEntry[]> => {
    const response = await apiRequest<ListEnvelope<AuditLogEntry>>({
        auth: true,
        path: `/api/v1/backoffice/properties/${propertyId}/audit`,
    });

    return response.items;
};

export const getPortfolioAnalytics = async (filters: Record<string, string | undefined> = {}): Promise<PortfolioAnalytics> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
            params.set(key, value);
        }
    });
    const path = params.toString() === "" ? "/api/v1/backoffice/analytics/portfolio" : `/api/v1/backoffice/analytics/portfolio?${params.toString()}`;
    const response = await apiRequest<ItemEnvelope<PortfolioAnalytics>>({
        auth: true,
        path,
    });

    return response.item;
};

export const listIntegrations = async (): Promise<IntegrationConfig[]> => {
    const response = await apiRequest<ListEnvelope<IntegrationConfig>>({
        auth: true,
        path: "/api/v1/backoffice/integrations",
    });

    return response.items;
};

export const saveIntegration = async (payload: IntegrationConfig): Promise<IntegrationConfig> => {
    const response = await apiRequest<ItemEnvelope<IntegrationConfig>, IntegrationConfig>({
        auth: true,
        body: payload,
        method: "POST",
        path: "/api/v1/backoffice/integrations",
    });

    return response.item;
};

export const testIntegration = async (integrationId: string): Promise<IntegrationDelivery> => {
    const response = await apiRequest<ItemEnvelope<IntegrationDelivery>>({
        auth: true,
        method: "POST",
        path: `/api/v1/backoffice/integrations/${integrationId}/test`,
    });

    return response.item;
};

export const listIntegrationDeliveries = async (): Promise<IntegrationDelivery[]> => {
    const response = await apiRequest<ListEnvelope<IntegrationDelivery>>({
        auth: true,
        path: "/api/v1/backoffice/integration-deliveries",
    });

    return response.items;
};

export const getSystemHealth = async (): Promise<SystemHealth> => {
    const response = await apiRequest<ItemEnvelope<SystemHealth>>({
        auth: true,
        path: "/api/v1/admin/system-health",
    });

    return response.item;
};

export const listSchedulerPauses = async (): Promise<SchedulerPause[]> => {
    const response = await apiRequest<ListEnvelope<SchedulerPause>>({
        auth: true,
        path: "/api/v1/admin/scheduler/pauses",
    });

    return response.items;
};

export const createSchedulerPause = async (payload: SchedulerPause): Promise<SchedulerPause> => {
    const response = await apiRequest<ItemEnvelope<SchedulerPause>, SchedulerPause>({
        auth: true,
        body: payload,
        method: "POST",
        path: "/api/v1/admin/scheduler/pauses",
    });

    return response.item;
};

export const deleteSchedulerPause = async (pauseId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/admin/scheduler/pauses/${pauseId}`,
    });
};

export const listMaintenanceWindows = async (): Promise<MaintenanceWindow[]> => {
    const response = await apiRequest<ListEnvelope<MaintenanceWindow>>({
        auth: true,
        path: "/api/v1/admin/maintenance-windows",
    });

    return response.items;
};

export const createMaintenanceWindow = async (payload: MaintenanceWindow): Promise<MaintenanceWindow> => {
    const response = await apiRequest<ItemEnvelope<MaintenanceWindow>, MaintenanceWindow>({
        auth: true,
        body: payload,
        method: "POST",
        path: "/api/v1/admin/maintenance-windows",
    });

    return response.item;
};

export const deleteMaintenanceWindow = async (windowId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/admin/maintenance-windows/${windowId}`,
    });
};

export const previewPropertyImport = async (file: File): Promise<ImportPreview> => {
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(buildApiUrl("/api/v1/backoffice/properties/import/preview"), {
        body: formData,
        headers: authHeaders(),
        method: "POST",
    });
    const payload = await response.json() as ItemEnvelope<ImportPreview>;
    if (!response.ok) {
        throw new ApiError(typeof payload === "object" && payload !== null && "error" in payload ? String((payload as { error?: string; }).error) : "Import preview failed.", response.status, payload);
    }

    return payload.item;
};

export const importProperties = async (file: File): Promise<ImportPreview> => {
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(buildApiUrl("/api/v1/backoffice/properties/import"), {
        body: formData,
        headers: authHeaders(),
        method: "POST",
    });
    const payload = await response.json() as ItemEnvelope<ImportPreview>;
    if (!response.ok) {
        throw new ApiError(typeof payload === "object" && payload !== null && "error" in payload ? String((payload as { error?: string; }).error) : "Import failed.", response.status, payload);
    }

    return payload.item;
};

export const exportProperties = async (): Promise<Blob> => {
    const response = await fetch(buildApiUrl("/api/v1/backoffice/properties/export"), {
        headers: authHeaders(),
        method: "GET",
    });
    if (!response.ok) {
        throw new ApiError("Export failed.", response.status);
    }

    return response.blob();
};

export const exportWorkspace = async (): Promise<WorkspaceExport> => {
    const response = await apiRequest<ItemEnvelope<WorkspaceExport>>({
        auth: true,
        path: "/api/v1/admin/workspace/export",
    });

    return response.item;
};

export const restoreWorkspace = async (payload: WorkspaceExport, dryRun: boolean): Promise<ImportPreview> => {
    const response = await apiRequest<ItemEnvelope<ImportPreview>, WorkspaceExport>({
        auth: true,
        body: payload,
        method: "POST",
        path: `/api/v1/admin/workspace/restore?dry_run=${dryRun ? "true" : "false"}`,
    });

    return response.item;
};
