import type { RunFilters } from "@/services/backoffice-runs/runs.types";

/**
 * Defines stable query keys for ingestion runs.
 */
export const runKeys = {
    detail: (runId: string) => ["backoffice", "runs", "detail", runId] as const,
    list: (filters: RunFilters) => ["backoffice", "runs", "list", filters] as const,
};