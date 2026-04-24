import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { Select } from "@/components/ui/Select";
import { authKeys } from "@/services/auth/auth.keys";
import { listWorkspaceUsers } from "@/services/auth/auth.service";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { listSources } from "@/services/backoffice-sources/sources.service";
import { tagKeys } from "@/services/tags/tags.keys";
import { listTags } from "@/services/tags/tags.service";
import { workspaceKeys } from "@/services/workspace/workspace.keys";
import { getPortfolioAnalytics } from "@/services/workspace/workspace.service";

export const PortfolioAnalyticsPage = (): JSX.Element => {
    const [tag, setTag] = useState("");
    const [source, setSource] = useState("");
    const [owner, setOwner] = useState("");
    const [priority, setPriority] = useState("");
    const [timeRangeDays, setTimeRangeDays] = useState("30");

    const filters = useMemo(() => ({
        owner: owner || undefined,
        priority: priority || undefined,
        source: source || undefined,
        tag: tag || undefined,
        time_range_days: timeRangeDays || undefined,
    }), [owner, priority, source, tag, timeRangeDays]);

    const analyticsQuery = useQuery({
        queryFn: () => getPortfolioAnalytics(filters),
        queryKey: workspaceKeys.analytics(filters),
    });
    const tagsQuery = useQuery({
        queryFn: listTags,
        queryKey: tagKeys.list(),
    });
    const sourcesQuery = useQuery({
        queryFn: listSources,
        queryKey: sourceKeys.list(),
    });
    const usersQuery = useQuery({
        queryFn: listWorkspaceUsers,
        queryKey: authKeys.users(),
    });

    const analytics = analyticsQuery.data;

    return (
        <PageStack>
            <PageCard
                description={"Workspace-level reporting stays near real time with a published refresh frequency."}
                title={"Portfolio Analytics"}
            >
                <FormGrid>
                    <Field label={"Tag"}>
                        <Select onChange={(event) => { setTag(event.target.value); }} value={tag}>
                            <option value={""}>{"All tags"}</option>
                            {(tagsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </Select>
                    </Field>
                    <Field label={"Source"}>
                        <Select onChange={(event) => { setSource(event.target.value); }} value={source}>
                            <option value={""}>{"All sources"}</option>
                            {(sourcesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </Select>
                    </Field>
                    <Field label={"Owner"}>
                        <Select onChange={(event) => { setOwner(event.target.value); }} value={owner}>
                            <option value={""}>{"All owners"}</option>
                            {(usersQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}
                        </Select>
                    </Field>
                    <Field label={"Priority"}>
                        <Select onChange={(event) => { setPriority(event.target.value); }} value={priority}>
                            <option value={""}>{"All priorities"}</option>
                            <option value={"low"}>{"low"}</option>
                            <option value={"medium"}>{"medium"}</option>
                            <option value={"high"}>{"high"}</option>
                            <option value={"critical"}>{"critical"}</option>
                        </Select>
                    </Field>
                    <Field label={"Time range"}>
                        <Select onChange={(event) => { setTimeRangeDays(event.target.value); }} value={timeRangeDays}>
                            <option value={"7"}>{"Last 7 days"}</option>
                            <option value={"30"}>{"Last 30 days"}</option>
                            <option value={"90"}>{"Last 90 days"}</option>
                        </Select>
                    </Field>
                </FormGrid>
                <p className={"muted-copy"}>
                    {analytics === undefined ? "Loading analytics..." : `Refresh frequency: every ${analytics.update_frequency_seconds} seconds.`}
                </p>
            </PageCard>

            <PageCard description={"Trend snapshots help teams distinguish signal from noise."} title={"Trend Summaries"}>
                <FormGrid>
                    <DataTable
                        caption={"Price change trends"}
                        columns={[
                            { cell: (item) => item.label, header: "Period", id: "label" },
                            { cell: (item) => item.value.toFixed(2), header: "Price change movement", id: "value" },
                        ]}
                        compact
                        emptyMessage={"No price-change trend data yet."}
                        getRowId={(item) => item.label}
                        items={analytics?.price_change_trends ?? []}
                        pageSize={5}
                    />
                    <DataTable
                        caption={"Failure rate trends"}
                        columns={[
                            { cell: (item) => item.label, header: "Period", id: "label" },
                            { cell: (item) => item.value.toFixed(2), header: "Failure count", id: "value" },
                        ]}
                        compact
                        emptyMessage={"No failure trend data yet."}
                        getRowId={(item) => item.label}
                        items={analytics?.failure_rate_trends ?? []}
                        pageSize={5}
                    />
                    <DataTable
                        caption={"Alert volume trends"}
                        columns={[
                            { cell: (item) => item.label, header: "Period", id: "label" },
                            { cell: (item) => item.value.toFixed(2), header: "Alerts", id: "value" },
                        ]}
                        compact
                        emptyMessage={"No alert volume data yet."}
                        getRowId={(item) => item.label}
                        items={analytics?.alert_volume_trends ?? []}
                        pageSize={5}
                    />
                </FormGrid>
            </PageCard>

            <PageCard description={"Use workspace rankings to set operational priorities."} title={"Rankings and Risks"}>
                <DataTable
                    caption={"Source reliability"}
                    columns={[
                        { cell: (item) => item.label, header: "Source", id: "label" },
                        { cell: (item) => item.value.toFixed(2), header: "Reliability", id: "value" },
                    ]}
                    compact
                    emptyMessage={"No source reliability data yet."}
                    getRowId={(item) => item.source_id ?? item.label}
                    items={analytics?.source_reliability ?? []}
                    pageSize={5}
                />
                <DataTable
                    caption={"Largest price movers"}
                    columns={[
                        { cell: (item) => item.label, header: "Property", id: "label" },
                        { cell: (item) => item.value.toFixed(2), header: "Movement", id: "value" },
                    ]}
                    compact
                    emptyMessage={"No price-mover data yet."}
                    getRowId={(item) => item.property_id}
                    items={analytics?.largest_price_movers ?? []}
                    pageSize={5}
                />
                <DataTable
                    caption={"Most volatile properties"}
                    columns={[
                        { cell: (item) => item.label, header: "Property", id: "label" },
                        { cell: (item) => item.value.toFixed(2), header: "Volatility", id: "value" },
                    ]}
                    compact
                    emptyMessage={"No volatility data yet."}
                    getRowId={(item) => item.property_id}
                    items={analytics?.most_volatile_properties ?? []}
                    pageSize={5}
                />
                <DataTable
                    caption={"Operational risk"}
                    columns={[
                        { cell: (item) => item.label, header: "Property", id: "label" },
                        { cell: (item) => item.value.toFixed(2), header: "Risk score", id: "value" },
                    ]}
                    compact
                    emptyMessage={"No operational risk data yet."}
                    getRowId={(item) => item.property_id}
                    items={analytics?.operational_risk ?? []}
                    pageSize={5}
                />
            </PageCard>
        </PageStack>
    );
};
