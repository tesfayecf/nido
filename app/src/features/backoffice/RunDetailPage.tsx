import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { Preformatted } from "@/components/ui/Preformatted";
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
            <PageStack>
                <PageCard description={"The route was loaded without a run identifier."} title={"Run detail unavailable"}>
                    <ErrorBanner>{"A run id is required."}</ErrorBanner>
                </PageCard>
            </PageStack>
        );
    }

    if (runQuery.isLoading) {
        return (
            <PageStack>
                <PageCard description={"The run metadata and extracted values are loading."} title={"Run Detail"}>
                    <p className={"muted-copy"}>{"Loading run..."}</p>
                </PageCard>
            </PageStack>
        );
    }

    if (runQuery.isError || runQuery.data === undefined) {
        return (
            <PageStack>
                <PageCard description={"The selected run could not be loaded."} title={"Run Detail"}>
                    <ErrorBanner>{"Could not load run detail."}</ErrorBanner>
                </PageCard>
            </PageStack>
        );
    }

    const run = runQuery.data;

    return (
        <PageStack>
            <PageCard
                action={<Button as={Link} to={"/runs"} variant={"secondary"}>{"Back to runs"}</Button>}
                description={"A run stores the extracted snapshot values plus change flags and any extraction error."}
                title={`Run ${run.id}`}
            >
                <KeyValueGrid>
                    <KeyValuePair label={"Status"} value={<StatusBadge tone={run.is_valid ? "success" : "warning"} value={run.is_valid ? "valid" : "invalid"} />} />
                    <KeyValuePair label={"Property id"} value={run.property_id} />
                    <KeyValuePair label={"Observed at"} value={formatDateTime(run.observed_at)} />
                    <KeyValuePair label={"Config version"} value={run.config_version} />
                </KeyValueGrid>
                {run.error_message !== undefined && run.error_message !== "" ? <ErrorBanner>{run.error_message}</ErrorBanner> : null}
            </PageCard>
            <PageCard description={"Extracted values are stored exactly as captured by the run."} title={"Extracted Data"}>
                <Preformatted>{JSON.stringify(run.values, null, 2)}</Preformatted>
            </PageCard>
            <PageCard description={"Change flags indicate which fields changed compared with the previous valid run."} title={"Change Flags"}>
                <Preformatted>{JSON.stringify(run.change_flags ?? {}, null, 2)}</Preformatted>
            </PageCard>
        </PageStack>
    );
};
