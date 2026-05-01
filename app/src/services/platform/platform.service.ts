import { apiRequest, type ItemEnvelope } from "@/lib/api/client";
import type { PlatformSettings } from "@/services/platform/platform.types";

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
