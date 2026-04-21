import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { PageCard } from "@/components/ui/PageCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format/date";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { getRun } from "@/services/backoffice-runs/runs.service";

export const RunDetailPage = (): JSX.Element => {
    const { runId = "" } = useParams();
    const runQuery = useQuery({
        enabled: runId !== "",
        queryFn: () => getRun(runId),
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
                <PageCard description={"The run metadata and extracted values are loading."} title={"Run Detail"}>
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
                action={<Link className={"button button--secondary"} to={"/runs"}>{"Back to runs"}</Link>}
                description={"A run stores the extracted snapshot values plus change flags and any extraction error."}
                title={`Run ${run.id}`}
            >
                <div className={"key-value-grid"}>
                    <div>
                        <span className={"key-value-grid__label"}>{"Status"}</span>
                        <strong className={"key-value-grid__value"}><StatusBadge tone={run.is_valid ? "success" : "warning"} value={run.is_valid ? "valid" : "invalid"} /></strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Property id"}</span>
                        <strong className={"key-value-grid__value"}>{run.property_id}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Observed at"}</span>
                        <strong className={"key-value-grid__value"}>{formatDateTime(run.observed_at)}</strong>
                    </div>
                    <div>
                        <span className={"key-value-grid__label"}>{"Config version"}</span>
                        <strong className={"key-value-grid__value"}>{run.config_version}</strong>
                    </div>
                </div>
                {run.error_message !== undefined && run.error_message !== "" ? <p className={"error-banner"}>{run.error_message}</p> : null}
            </PageCard>
            <PageCard description={"Extracted values are stored exactly as captured by the run."} title={"Extracted Data"}>
                <pre className={"preformatted"}>{JSON.stringify(run.values, null, 2)}</pre>
            </PageCard>
            <PageCard description={"Change flags indicate which fields changed compared with the previous valid run."} title={"Change Flags"}>
                <pre className={"preformatted"}>{JSON.stringify(run.change_flags ?? {}, null, 2)}</pre>
            </PageCard>
        </div>
    );
};
