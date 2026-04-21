import { apiRequest, type ItemEnvelope, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";

import type { Source } from "@/services/backoffice-sources/sources.types";

export const listSources = async (): Promise<Source[]> => {
    const response = await apiRequest<ListEnvelope<Source>>({
        auth: true,
        path: "/api/v1/backoffice/sources",
    });

    return response.items;
};

export const getSource = async (sourceId: string): Promise<Source> => {
    const response = await apiRequest<ItemEnvelope<Source>>({
        auth: true,
        path: `/api/v1/backoffice/sources/${sourceId}`,
    });

    return response.item;
};

export const upsertSource = async (source: Source): Promise<Source> => {
    const response = await apiRequest<ItemEnvelope<Source>, Source>({
        auth: true,
        body: source,
        method: "POST",
        path: "/api/v1/backoffice/sources",
    });

    return response.item;
};

export const deleteSource = async (sourceId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/backoffice/sources/${sourceId}`,
    });
};
