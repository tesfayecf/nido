import { apiRequest, type ItemEnvelope, type ListEnvelope } from "@/lib/api/client";

import type { Source } from "@/services/backoffice-sources/sources.types";

/**
 * Loads all configured sources.
 *
 * @returns The source collection.
 */
export const listSources = async (): Promise<Source[]> => {
    const response = await apiRequest<ListEnvelope<Source>>({
        auth: true,
        path: "/api/v1/backoffice/sources",
    });

    return response.items;
};

/**
 * Loads one source detail payload.
 *
 * @param sourceId The source identifier.
 * @returns The source detail.
 */
export const getSource = async (sourceId: string): Promise<Source> => {
    const response = await apiRequest<ItemEnvelope<Source>>({
        auth: true,
        path: `/api/v1/backoffice/sources/${sourceId}`,
    });

    return response.item;
};

/**
 * Upserts one source through the backend POST contract.
 *
 * @param source The source payload to submit.
 * @returns The backend echo payload.
 */
export const upsertSource = async (source: Source): Promise<Source> => {
    const response = await apiRequest<ItemEnvelope<Source>, Source>({
        auth: true,
        body: source,
        method: "POST",
        path: "/api/v1/backoffice/sources",
    });

    return response.item;
};