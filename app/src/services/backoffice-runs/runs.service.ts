import { apiRequest, type ItemEnvelope, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";

import type { Run, RunFilters } from "@/services/backoffice-runs/runs.types";

export const listRuns = async (filters: RunFilters): Promise<ListEnvelope<Run>> => {
    const params = new URLSearchParams();
    if (filters.property_id.trim() !== "") {
        params.set("property_id", filters.property_id.trim());
    }

    params.set("limit", `${filters.limit}`);

    return apiRequest<ListEnvelope<Run>>({
        auth: true,
        path: `/api/v1/backoffice/runs?${params.toString()}`,
    });
};

export const getRun = async (runId: string): Promise<Run> => {
    const response = await apiRequest<ItemEnvelope<Run>>({
        auth: true,
        path: `/api/v1/backoffice/runs/${runId}`,
    });

    return response.item;
};

export const deleteRun = async (runId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/backoffice/runs/${runId}`,
    });
};
