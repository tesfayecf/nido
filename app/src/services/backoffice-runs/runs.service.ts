import { apiRequest, type ItemEnvelope, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";

import type { Run, RunFilters } from "@/services/backoffice-runs/runs.types";

/**
 * Loads runs using the current backend filters.
 *
 * @param filters The source and limit filters.
 * @returns The run collection.
 */
export const listRuns = async (filters: RunFilters): Promise<ListEnvelope<Run>> => {
    const params = new URLSearchParams();
    if (filters.source_id.trim() !== "") {
        params.set("source_id", filters.source_id.trim());
    }

    params.set("limit", `${filters.limit}`);

    return apiRequest<ListEnvelope<Run>>({
        auth: true,
        path: `/api/v1/backoffice/runs?${params.toString()}`,
    });
};

/**
 * Loads one run detail payload.
 *
 * @param runId The run identifier.
 * @returns The run detail.
 */
export const getRun = async (runId: string): Promise<Run> => {
    const response = await apiRequest<ItemEnvelope<Run>>({
        auth: true,
        path: `/api/v1/backoffice/runs/${runId}`,
    });

    return response.item;
};

/**
 * Triggers a manual ingest for one source.
 *
 * @param sourceId The source identifier.
 * @param force Whether the backend should bypass rate-limit checks.
 * @returns The resulting run snapshot.
 */
export const ingestSource = async (sourceId: string, force: boolean): Promise<Run> => {
    const suffix = force ? "?force=true" : "";
    const response = await apiRequest<ItemEnvelope<Run>, undefined>({
        auth: true,
        method: "POST",
        path: `/api/v1/backoffice/sources/${sourceId}/ingest${suffix}`,
    });

    return response.item;
};