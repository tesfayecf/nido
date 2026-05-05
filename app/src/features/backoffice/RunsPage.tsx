/**
 * File: app/src/features/backoffice/RunsPage.tsx
 *
 * Purpose:
 * Implements the backoffice feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, @tanstack/react-query, react-router-dom, @/components/ui/Button, @/components/ui/ConfirmDialog, @/components/ui/Dialog, @/components/ui/Field, @/components/ui/FormGrid; additional imports omitted for brevity
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @tanstack/react-query
 * - react-router-dom
 * - @/components/ui/Button
 * - @/components/ui/ConfirmDialog
 * - @/components/ui/Dialog
 * - @/components/ui/Field
 * - @/components/ui/FormGrid
 * - @/components/ui/Input
 * - @/components/ui/PageCard
 *
 * Key Decisions:
 * - Keeps documentation adjacent to the implementation so future changes update behavior and context together.
 * - Uses explicit imports and typed boundaries to make ownership traceable from this file in isolation.
 *
 * Constraints:
 * - Documentation must remain synchronized with behavior, tests, and related docs when this file changes.
 * - Runtime behavior must not depend on comments or documentation-only metadata.
 *
 * Related:
 * - /docs/frontend/documentation-template.md
 * - /app/docs/features/backoffice.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { useEffect, useMemo, useState } from "react";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { QueryDataTable } from "@/components/ui/QueryDataTable";
import { SecondarySurfaceHeader } from "@/components/ui/SecondarySurfaceHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDateTime } from "@/lib/format/date";
import { readNumberParam, readStringParam, writeParam } from "@/lib/routing/searchParams";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { deleteRun, listRuns } from "@/services/backoffice-runs/runs.service";
import type { Run, RunFilters } from "@/services/backoffice-runs/runs.types";
import { propertyKeys } from "@/services/properties/properties.keys";
import { ingestProperty, listProperties } from "@/services/properties/properties.service";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { listSources } from "@/services/backoffice-sources/sources.service";
import { tagKeys } from "@/services/tags/tags.keys";
import { listPropertyTags, listTags } from "@/services/tags/tags.service";

/**
 * Purpose: Renders the RunsPage UI boundary documented for app/src/features/backoffice/RunsPage.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const RunsPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const filters: RunFilters = {
        limit: readNumberParam(searchParams, "limit", 25),
        property_id: readStringParam(searchParams, "property_id"),
    };
    const [draftPropertyId, setDraftPropertyId] = useState(filters.property_id);
    const [draftLimit, setDraftLimit] = useState(`${filters.limit}`);
    const [triggerOpen, setTriggerOpen] = useState(false);
    const [triggerMode, setTriggerMode] = useState<"property" | "source" | "tag">("property");
    const [triggerPropertyId, setTriggerPropertyId] = useState(filters.property_id);
    const [triggerSourceId, setTriggerSourceId] = useState("");
    const [triggerTagId, setTriggerTagId] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<Run | null>(null);
    const runsQuery = useQuery({
        placeholderData: keepPreviousData,
        queryFn: () => listRuns(filters),
        queryKey: runKeys.list(filters),
    });
    const propertiesQuery = useQuery({
        queryFn: () => listProperties(),
        queryKey: propertyKeys.list(),
    });
    const sourcesQuery = useQuery({
        queryFn: listSources,
        queryKey: sourceKeys.list(),
    });
    const tagsQuery = useQuery({
        queryFn: listTags,
        queryKey: tagKeys.list(),
    });
    const triggerMutation = useMutation({
        mutationFn: async () => {
            const properties = propertiesQuery.data ?? [];
            if (triggerMode === "property") {
                await ingestProperty(triggerPropertyId);
                return 1;
            }

            if (triggerMode === "source") {
                const sourceMatches = properties.filter((property) => property.source_id === triggerSourceId);
                await Promise.all(sourceMatches.map((property) => ingestProperty(property.id)));
                return sourceMatches.length;
            }

            const taggedProperties = await Promise.all(properties.map(async (property) => ({
                property,
                tags: await listPropertyTags(property.id),
            })));
            const tagMatches = taggedProperties.filter((item) => item.tags.some((tag) => tag.id === triggerTagId));
            await Promise.all(tagMatches.map((item) => ingestProperty(item.property.id)));
            return tagMatches.length;
        },
        onError() {
            pushToast("Could not trigger the run.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: runKeys.all() });
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            setTriggerOpen(false);
            pushToast("Run started.", "success");
        },
    });
    const deleteMutation = useMutation({
        mutationFn: deleteRun,
        onError() {
            pushToast("Could not delete the run.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: runKeys.all() });
            setDeleteTarget(null);
            pushToast("Run deleted.", "success");
        },
    });

    useEffect(() => {
        setDraftPropertyId(filters.property_id);
        setDraftLimit(`${filters.limit}`);
        setTriggerPropertyId(filters.property_id);
    }, [filters.limit, filters.property_id]);

    const propertyOptions = useMemo(() => propertiesQuery.data ?? [], [propertiesQuery.data]);
    const runsInView = runsQuery.data?.items ?? [];
    const failureCount = runsInView.filter((run) => !run.is_valid && run.error_message !== undefined && run.error_message !== "").length;
    const triggerDisabled = triggerMode === "property"
        ? triggerPropertyId.trim() === ""
        : triggerMode === "source"
            ? triggerSourceId.trim() === ""
            : triggerTagId.trim() === "";

    return (
        <>
            <PageStack>
                <SecondarySurfaceHeader
                    action={<Button onClick={() => { setTriggerOpen(true); }}>{"Create run"}</Button>}
                    description={"Runs are stored as snapshots and managed directly from the table."}
                    summaryAriaLabel={"Runs overview"}
                    summaryItems={[
                        {
                            context: runsQuery.isLoading ? "Loading run history." : `Limit set to ${filters.limit}.`,
                            label: "In view",
                            value: runsQuery.isLoading ? "—" : `${runsInView.length}`,
                        },
                        {
                            context: runsQuery.isLoading ? "Loading run failures." : failureCount === 0 ? "No failed runs in the current scope." : "Review the error column to diagnose failures.",
                            label: "Failures",
                            value: runsQuery.isLoading ? "—" : `${failureCount}`,
                        },
                        {
                            context: filters.property_id === "" ? "Showing all properties." : `Filtered to property ${filters.property_id}.`,
                            label: "Scope",
                            value: filters.property_id === "" ? "All" : filters.property_id,
                        },
                    ]}
                    title={"Runs"}
                >
                    <FormGrid
                        variant={"inline"}
                        onSubmit={(event) => {
                            event.preventDefault();
                            const nextParams = new URLSearchParams(searchParams);
                            writeParam(nextParams, "property_id", draftPropertyId);
                            writeParam(nextParams, "limit", draftLimit);
                            setSearchParams(nextParams);
                        }}
                    >
                        <Field label={"Property id"}>
                            <Input onChange={(event) => { setDraftPropertyId(event.target.value); }} value={draftPropertyId} />
                        </Field>
                        <Field label={"Limit"}>
                            <Input min={1} onChange={(event) => { setDraftLimit(event.target.value); }} step={1} type={"number"} value={draftLimit} />
                        </Field>
                        <Field as={"div"} variant={"actions"}>
                            <Button type={"submit"}>{"Apply"}</Button>
                        </Field>
                    </FormGrid>
                </SecondarySurfaceHeader>

                <PageCard description={"Select a row to inspect the full snapshot payload."} title={"Run history"}>
                    <QueryDataTable
                    caption={"Recent runs"}
                    columns={[
                        {
                            cell: (item) => item.id,
                            header: "Run",
                            id: "id",
                            sortValue: (item) => item.id,
                        },
                        {
                            cell: (item) => item.property_id,
                            header: "Property",
                            id: "property_id",
                            sortValue: (item) => item.property_id,
                        },
                        {
                            cell: (item) => <StatusBadge tone={statusTone(item)} value={item.is_valid ? "valid" : "invalid"} />,
                            header: "Status",
                            id: "status",
                            sortValue: (item) => item.is_valid ? "valid" : "invalid",
                        },
                        {
                            cell: (item) => formatDateTime(item.observed_at),
                            header: "Observed",
                            id: "observed_at",
                            sortValue: (item) => item.observed_at,
                        },
                        {
                            align: "right",
                            cell: (item) => `${Object.keys(item.values).length}`,
                            header: "Fields",
                            id: "fields",
                            sortValue: (item) => Object.keys(item.values).length,
                        },
                        {
                            cell: (item) => item.error_message === undefined || item.error_message === "" ? "Completed" : item.error_message,
                            header: "Message",
                            id: "message",
                        },
                        {
                            cell: (item) => (
                                <div className={"action-group"} onClick={(event) => { event.stopPropagation(); }}>
                                    <Button
                                        onClick={() => {
                                            void navigate(`/runs/${item.id}`);
                                        }}
                                        size={"small"}
                                        variant={"secondary"}
                                    >
                                        {"Open"}
                                    </Button>
                                    <Button onClick={() => { setDeleteTarget(item); }} size={"small"} variant={"secondary"}>{"Delete"}</Button>
                                </div>
                            ),
                            header: "Actions",
                            id: "actions",
                        },
                    ]}
                    compact
                    emptyMessage={"No runs matched the current filters."}
                    errorMessage={"Could not load runs."}
                    getRowId={(item) => item.id}
                    isError={runsQuery.isError}
                    isLoading={runsQuery.isLoading}
                    items={runsQuery.data?.items ?? []}
                    loadingMessage={"Loading runs..."}
                    onRowClick={(item) => { void navigate(`/runs/${item.id}`); }}
                    pageSize={12}
                    rowLabel={(item) => `Open run ${item.id}`}
                    />
                </PageCard>
            </PageStack>

            <Dialog
                onOpenChange={setTriggerOpen}
                open={triggerOpen}
                title={"Create run"}
            >
                <FormGrid
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!triggerDisabled) {
                            triggerMutation.mutate();
                        }
                    }}
                >
                    <Field label={"Run by"}>
                        <Select onChange={(event) => { setTriggerMode(event.target.value as "property" | "source" | "tag"); }} value={triggerMode}>
                            <option value={"property"}>{"Property"}</option>
                            <option value={"source"}>{"Source"}</option>
                            <option value={"tag"}>{"Tag"}</option>
                        </Select>
                    </Field>
                    {triggerMode === "property" ? (
                        <Field label={"Property"}>
                            <Select onChange={(event) => { setTriggerPropertyId(event.target.value); }} value={triggerPropertyId}>
                                <option value={""}>{"Select a property"}</option>
                                {propertyOptions.map((property) => (
                                    <option key={property.id} value={property.id}>
                                        {property.label !== "" ? property.label : property.url}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    ) : null}
                    {triggerMode === "source" ? (
                        <Field label={"Source"}>
                            <Select onChange={(event) => { setTriggerSourceId(event.target.value); }} value={triggerSourceId}>
                                <option value={""}>{"Select a source"}</option>
                                {(sourcesQuery.data ?? []).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                            </Select>
                        </Field>
                    ) : null}
                    {triggerMode === "tag" ? (
                        <Field label={"Tag"}>
                            <Select onChange={(event) => { setTriggerTagId(event.target.value); }} value={triggerTagId}>
                                <option value={""}>{"Select a tag"}</option>
                                {(tagsQuery.data ?? []).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                            </Select>
                        </Field>
                    ) : null}
                    <div className={"action-group"}>
                        <Button onClick={() => { setTriggerOpen(false); }} variant={"secondary"}>{"Cancel"}</Button>
                        <Button disabled={triggerDisabled} isLoading={triggerMutation.isPending} type={"submit"}>
                            {"Trigger run"}
                        </Button>
                    </div>
                </FormGrid>
            </Dialog>

            <ConfirmDialog
                confirmLabel={"Delete run"}
                description={deleteTarget === null ? "" : `Delete run ${deleteTarget.id}? This removes the stored snapshot permanently.`}
                isPending={deleteMutation.isPending}
                onConfirm={() => {
                    if (deleteTarget !== null) {
                        deleteMutation.mutate(deleteTarget.id);
                    }
                }}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteTarget(null);
                    }
                }}
                open={deleteTarget !== null}
                title={"Delete run"}
            />
        </>
    );
};

const statusTone = (run: Run): "danger" | "success" | "warning" => {
    if (!run.is_valid && run.error_message !== undefined && run.error_message !== "") {
        return "danger";
    }

    return run.is_valid ? "success" : "warning";
};
