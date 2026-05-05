/**
 * File: app/src/features/backoffice/SourcesPage.tsx
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
 * - Imports: react, @tanstack/react-query, react-router-dom, @/components/ui/Button, @/components/ui/ConfirmDialog, @/components/ui/Icon, @/components/ui/PageCard, @/components/ui/PageStack; additional imports omitted for brevity
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
 * - @/components/ui/Icon
 * - @/components/ui/PageCard
 * - @/components/ui/PageStack
 * - @/components/ui/QueryDataTable
 * - @/components/ui/RowActions
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
import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { QueryDataTable } from "@/components/ui/QueryDataTable";
import { RowActions } from "@/components/ui/RowActions";
import { SecondarySurfaceHeader } from "@/components/ui/SecondarySurfaceHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDateTime } from "@/lib/format/date";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { deleteSource, listSources } from "@/services/backoffice-sources/sources.service";
import type { Source } from "@/services/backoffice-sources/sources.types";
import { propertyKeys } from "@/services/properties/properties.keys";
import { ingestProperty, listProperties } from "@/services/properties/properties.service";
import type { Property } from "@/services/properties/properties.types";

/**
 * Purpose: Renders the SourcesPage UI boundary documented for app/src/features/backoffice/SourcesPage.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const SourcesPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [deleteTarget, setDeleteTarget] = useState<Source | null>(null);
    const [bulkTarget, setBulkTarget] = useState<Source | null>(null);
    const [bulkProgress, setBulkProgress] = useState<{ done: number; failed: number; total: number; } | null>(null);
    const sourcesQuery = useQuery({
        queryFn: listSources,
        queryKey: sourceKeys.list(),
    });
    const propertiesQuery = useQuery({
        queryFn: () => listProperties(),
        queryKey: propertyKeys.list(),
    });
    const deleteMutation = useMutation({
        mutationFn: deleteSource,
        onError() {
            pushToast("Could not delete source.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: sourceKeys.list() });
            setDeleteTarget(null);
            pushToast("Source deleted.", "success");
        },
    });

    const propertiesForBulk = useMemo<Property[]>(() => {
        if (bulkTarget === null) {
            return [];
        }

        return (propertiesQuery.data ?? []).filter((property) => property.source_id === bulkTarget.id);
    }, [bulkTarget, propertiesQuery.data]);

    const runBulk = async (): Promise<void> => {
        if (bulkTarget === null || propertiesForBulk.length === 0) {
            return;
        }

        setBulkProgress({ done: 0, failed: 0, total: propertiesForBulk.length });
        let done = 0;
        let failed = 0;
        for (const property of propertiesForBulk) {
            try {
                await ingestProperty(property.id);
                done += 1;
            } catch {
                failed += 1;
            }

            setBulkProgress({ done: done + failed, failed, total: propertiesForBulk.length });
        }

        await queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
        if (failed === 0) {
            pushToast(`Ran ${done} properties for ${bulkTarget.name}.`, "success");
        } else {
            pushToast(`Ran ${done} of ${propertiesForBulk.length}; ${failed} failed.`, "error");
        }

        setBulkTarget(null);
        setBulkProgress(null);
    };

    const sources = sourcesQuery.data ?? [];
    const rows = useMemo(() => {
        return sources.map((source) => ({
            ...source,
            fieldCount: readFieldCount(source.config_json),
        }));
    }, [sources]);
    const activeCount = sources.filter((source) => source.active !== false).length;
    const connectedProperties = (propertiesQuery.data ?? []).filter((property) => property.source_id !== undefined && property.source_id !== "");
    const templatesInUse = new Set(connectedProperties.map((property) => property.source_id)).size;

    return (
        <>
            <PageStack>
                <SecondarySurfaceHeader
                    action={(
                        <Button iconBefore={<Icon name={"plus"} />} onClick={() => { void navigate("/sources/new"); }}>
                            {"Create source"}
                        </Button>
                    )}
                    description={"Manage reusable source templates and run all linked properties from one predictable workspace."}
                    summaryAriaLabel={"Sources overview"}
                    summaryItems={[
                        {
                            context: sourcesQuery.isLoading ? "Loading source templates." : sources.length === 0 ? "No source templates configured yet." : `${templatesInUse} template${templatesInUse === 1 ? "" : "s"} linked to properties.`,
                            label: "Templates",
                            value: sourcesQuery.isLoading ? "—" : `${sources.length}`,
                        },
                        {
                            context: sourcesQuery.isLoading ? "Loading source status." : activeCount === 0 ? "No active templates are ready to run." : "Active templates can run linked properties.",
                            label: "Active",
                            value: sourcesQuery.isLoading ? "—" : `${activeCount}`,
                        },
                        {
                            context: propertiesQuery.isLoading ? "Loading property coverage." : connectedProperties.length === 0 ? "No properties are linked to a source." : "Use row actions to run all linked properties.",
                            label: "Tracked properties",
                            value: propertiesQuery.isLoading ? "—" : `${connectedProperties.length}`,
                        },
                    ]}
                    title={"Sources"}
                />

                <PageCard description={"Open a template to edit mappings, delete it, or run all linked properties."} title={"Source templates"}>
                    <QueryDataTable
                        caption={"Source templates"}
                        columns={[
                    {
                        cell: (item) => (
                            <div className={"data-table__primary"}>
                                <strong>{item.name}</strong>
                                <span className={"table-subcopy"}>{item.id}</span>
                            </div>
                        ),
                        header: "Template",
                        id: "name",
                        sortValue: (item) => item.name,
                    },
                    {
                        cell: (item) => <StatusBadge tone={item.active === false ? "danger" : "success"} value={item.active === false ? "inactive" : "active"} />,
                        header: "Status",
                        id: "status",
                        sortValue: (item) => item.active === false ? "inactive" : "active",
                        width: "8rem",
                    },
                    {
                        align: "right",
                        cell: (item) => `${item.fieldCount}`,
                        header: "Fields",
                        id: "fields",
                        sortValue: (item) => item.fieldCount,
                        width: "6rem",
                    },
                    {
                        cell: (item) => item.updated_at === undefined ? "—" : formatDateTime(item.updated_at),
                        header: "Updated",
                        id: "updated",
                        sortValue: (item) => item.updated_at ?? "",
                        width: "11rem",
                    },
                    {
                        cell: (item) => item.created_at === undefined ? "—" : formatDateTime(item.created_at),
                        header: "Created",
                        id: "created",
                        sortValue: (item) => item.created_at ?? "",
                        width: "11rem",
                    },
                    {
                        align: "right",
                        cell: (item) => (
                            <RowActions
                                menuItems={[
                                    {
                                        disabled: (propertiesQuery.data ?? []).filter((property) => property.source_id === item.id).length === 0,
                                        label: "Run all properties",
                                        onSelect: () => { setBulkTarget(item); },
                                    },
                                ]}
                            >
                                <button
                                    aria-label={"Open source"}
                                    className={"icon-button"}
                                    onClick={() => { void navigate(`/sources/${item.id}`); }}
                                    title={"Open source"}
                                    type={"button"}
                                >
                                    <Icon name={"edit"} />
                                </button>
                                <button
                                    aria-label={"Delete source"}
                                    className={"icon-button icon-button--danger"}
                                    onClick={() => { setDeleteTarget(item); }}
                                    title={"Delete"}
                                    type={"button"}
                                >
                                    <Icon name={"trash"} />
                                </button>
                            </RowActions>
                        ),
                        header: "Actions",
                        id: "actions",
                        width: "9rem",
                    },
                ]}
                        compact
                        emptyMessage={"No sources are configured yet."}
                        errorMessage={"Could not load sources."}
                        getRowId={(item) => item.id}
                        isError={sourcesQuery.isError}
                        isLoading={sourcesQuery.isLoading}
                        items={rows}
                        loadingMessage={"Loading sources..."}
                        onRowClick={(item) => { void navigate(`/sources/${item.id}`); }}
                        pageSize={20}
                        rowLabel={(item) => `Open source template ${item.name}`}
                    />
                </PageCard>
            </PageStack>

            <ConfirmDialog
                confirmLabel={"Delete source"}
                description={deleteTarget === null ? "" : `Delete ${deleteTarget.name}? This removes the source and any related ingestion artifacts.`}
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
                title={"Delete source"}
            />

            <ConfirmDialog
                confirmLabel={bulkProgress === null ? `Run ${propertiesForBulk.length} properties` : `Running ${bulkProgress.done}/${bulkProgress.total}`}
                description={bulkTarget === null
                    ? ""
                    : propertiesForBulk.length === 0
                        ? `${bulkTarget.name} has no properties yet.`
                        : `Run ${propertiesForBulk.length} properties for ${bulkTarget.name} sequentially. Each run uses its own retry configuration.`}
                isPending={bulkProgress !== null}
                onConfirm={() => { void runBulk(); }}
                onOpenChange={(open) => {
                    if (!open && bulkProgress === null) {
                        setBulkTarget(null);
                    }
                }}
                open={bulkTarget !== null}
                title={"Run all properties"}
            />
        </>
    );
};

const readFieldCount = (configJson: string | undefined): number => {
    if (configJson === undefined || configJson.trim() === "") {
        return 0;
    }

    try {
        const parsed = JSON.parse(configJson) as unknown;
        return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
        return 0;
    }
};
