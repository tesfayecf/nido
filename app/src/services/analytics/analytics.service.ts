import { apiRequest, type ListEnvelope } from "@/lib/api/client";

import type { AnalyticsRecord } from "@/services/analytics/analytics.types";

export const listAnalyticsDataset = async (): Promise<AnalyticsRecord[]> => {
    const response = await apiRequest<ListEnvelope<AnalyticsRecord>>({
        auth: true,
        path: "/api/v1/backoffice/analytics/dataset",
    });
    return response.items;
};
