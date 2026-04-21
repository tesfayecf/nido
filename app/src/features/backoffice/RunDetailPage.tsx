import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { PageCard } from "@/components/ui/PageCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format/date";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { getRun } from "@/services/backoffice-runs/runs.service";
import type { Run } from "@/services/backoffice-runs/runs.types";

/**
 * Hosts the ingestion run detail route.
 *
 * @returns The placeholder run detail screen.
 */
export const RunDetailPage = (): JSX.Element => {
    const { runId = "" } = useParams();
    const runQuery = useQuery({
        enabled: runId !== "",
        queryFn: () => {
            return getRun(runId);
        },
        queryKey: runKeys.detail(runId),
    });

    if (runId === "") {
        return (
            <div className={"page-stack"}>
                <PageCard description={"The route was loaded without a run identifier."} title={"Run detail unavailable"}>
                    <p className={"error-banner"}>{"A run id is required."}</p>
                </PageCard>
            </div>
        );
    }

    if (runQuery.isLoading) {
        return (
            <div className={"page-stack"}>
                <PageCard description={"The run metadata and diagnostics are loading."} title={"Run Detail"}>
                    <p className={"muted-copy"}>{"Loading run..."}</p>
                </PageCard>
            </div>
        );
    }

    if (runQuery.isError || runQuery.data === undefined) {
        return (
            <div className={"page-stack"}>
                <PageCard description={"The selected run could not be loaded."} title={"Run Detail"}>
                    <p className={"error-banner"}>{"Could not load run detail."}</p>
                </PageCard>
            </div>
        );
    }

    const run = runQuery.data;

    return (
        <div className={"page-stack"}>
            <PageCard
                action={<Link className={"button button--secondary"} to={"/backoffice/runs"}>{"Back to runs"}</Link>}
                description={"Run detail comes directly from the backend record, including diagnostics and artifact references when available."}
                title={`Run ${run.id}`}
            >
                <div className={"key-value-grid"}>
                    <div>
                        <span className={"key-value-grid__label"}>{"Status"}</span>
                        <strong className={"key-value-grid__value"}><StatusBadge tone={statusTone(run)} value={run.status} /></strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Source id"}</span>
                        <strong className={"key-value-grid__value"}>{run.source_id}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Trigger kind"}</span>
                        <strong className={"key-value-grid__value"}>{run.trigger_kind}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Correlation id"}</span>
                        <strong className={"key-value-grid__value"}>{run.correlation_id}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Started at"}</span>
                        <strong className={"key-value-grid__value"}>{formatDateTime(run.started_at)}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Finished at"}</span>
                        <strong className={"key-value-grid__value"}>{run.finished_at === undefined ? "—" : formatDateTime(run.finished_at)}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Attempts"}</span>
                        <strong className={"key-value-grid__value"}>{run.attempt_count}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Items"}</span>
                        <strong className={"key-value-grid__value"}>{run.item_count}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Artifact key"}</span>
                        <strong className={"key-value-grid__value"}>{run.artifact_key ?? "—"}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Failure artifact"}</span>
                        <strong className={"key-value-grid__value"}>{run.failure_artifact_key ?? "—"}</strong>
                    </div>
                </div>
                {run.error_message !== undefined && run.error_message !== "" ? <p className={"error-banner"}>{run.error_message}</p> : null}
            </PageCard>

            <PageCard description={"Diagnostics remain raw JSON in iteration 1 so backend additions flow through without a frontend rewrite."} title={"Diagnostics"}>
                <pre className={"preformatted"}>{JSON.stringify(run.diagnostics ?? null, null, 2)}</pre>
            </PageCard>
        </div>
    );
};

const statusTone = (run: Run): "danger" | "neutral" | "success" | "warning" => {
    switch (run.status) {
        case "completed":
            return "success";
        case "failed":
            return "danger";
        case "running":
            return "warning";
        default:
            return "neutral";
    }
};