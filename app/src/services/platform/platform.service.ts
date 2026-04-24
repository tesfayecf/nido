import { apiRequest, type ItemEnvelope, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";
import type { IntegrationDeliveryLog, PlatformSettings, SchedulerSummary } from "@/services/platform/platform.types";

export const getPlatformSettings = async (): Promise<PlatformSettings> => {
    const response = await apiRequest<ItemEnvelope<PlatformSettings>>({
        auth: true,
        path: "/api/v1/backoffice/platform/settings",
    });
    return response.item;
};

export const updatePlatformSettings = async (settings: PlatformSettings): Promise<PlatformSettings> => {
    const response = await apiRequest<ItemEnvelope<PlatformSettings>, PlatformSettings>({
        auth: true,
        body: settings,
        method: "PUT",
        path: "/api/v1/backoffice/platform/settings",
    });
    return response.item;
};

export const getPlatformSummary = async (): Promise<SchedulerSummary> => {
    const response = await apiRequest<ItemEnvelope<SchedulerSummary>>({
        auth: true,
        path: "/api/v1/backoffice/platform/summary",
    });
    return response.item;
};

export const listIntegrationDeliveries = async (limit = 50): Promise<IntegrationDeliveryLog[]> => {
    const response = await apiRequest<ListEnvelope<IntegrationDeliveryLog>>({
        auth: true,
        path: `/api/v1/backoffice/platform/deliveries?limit=${limit}`,
    });
    return response.items;
};

export const testPlatformChannel = async (channel: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "POST",
        path: `/api/v1/backoffice/platform/test/${encodeURIComponent(channel)}`,
    });
};
