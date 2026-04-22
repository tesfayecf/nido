import type { RunFilters } from "@/services/backoffice-runs/runs.types";

const runsRoot = ["backoffice", "runs"] as const;

/**
 * Defines stable query keys for ingestion runs.
 */
export const runKeys = {
    all: () => runsRoot,
    detail: (runId: string) => [...runsRoot, "detail", runId] as const,
    list: (filters: RunFilters) => [...runsRoot, "list", filters] as const,
};
