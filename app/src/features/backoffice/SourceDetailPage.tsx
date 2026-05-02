import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getExtractionMethodLabel, SelectorBuilder } from "@/components/selectors/SelectorBuilder";
import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { RowActions } from "@/components/ui/RowActions";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { FieldEditorDialog } from "@/features/backoffice/FieldEditorDialog";
import { formatDateTime } from "@/lib/format/date";
import { fieldKeys } from "@/services/fields/fields.keys";
import { listFields } from "@/services/fields/fields.service";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { deleteSource, getSource, upsertSource } from "@/services/backoffice-sources/sources.service";
import type { Source } from "@/services/backoffice-sources/sources.types";
import { listProperties, listPropertySnapshots, previewExtraction } from "@/services/properties/properties.service";
import type { PropertyPreviewFieldResult, PropertySnapshot } from "@/services/properties/properties.types";
import {
    buildPreviewFieldMap,
    createDefaultSelectorDrafts,
    createEmptySelectorDraft,
    draftToSelector,
    parseSelectorConfigJson,
    selectorToDraft,
    stringifySelectorConfigJson,
    validateSelectorDrafts,
    type SelectorFieldDraft,
} from "@/features/selectors/selectorSchema";

const defaultSourceState = (): Source => ({
    config_json: stringifySelectorConfigJson(createDefaultSelectorDrafts().map(draftToSelector)),
    id: "",
    name: "",
});

const getSelectorRole = (role: string | undefined): "prefill" | "tracked" => role === "tracked" ? "tracked" : "prefill";

export const SourceDetailPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const { sourceId } = useParams();
    const isCreateMode = sourceId === undefined;
    const sourceQuery = useQuery({
        enabled: sourceId !== undefined,
        queryFn: () => getSource(sourceId ?? ""),
        queryKey: sourceKeys.detail(sourceId ?? "new"),
    });
    const [formState, setFormState] = useState<Source>(defaultSourceState);
    const [previewUrl, setPreviewUrl] = useState("");
    const [selectorFields, setSelectorFields] = useState<SelectorFieldDraft[]>(createDefaultSelectorDrafts);
    const [configError, setConfigError] = useState<string | null>(null);
    const [previewFailures, setPreviewFailures] = useState<string[]>([]);
    const [previewMap, setPreviewMap] = useState<Map<string, PropertyPreviewFieldResult>>(new Map());
    const [fieldFilter, setFieldFilter] = useState("all");
    const [fieldSearch, setFieldSearch] = useState("");
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [fieldEditor, setFieldEditor] = useState<{ initial?: SelectorFieldDraft; mode: "add" | "edit"; targetId?: string; } | null>(null);
    const [fieldDeleteName, setFieldDeleteName] = useState<string | null>(null);
    const saveMutation = useMutation({
        mutationFn: upsertSource,
        onSuccess(savedSource) {
            void queryClient.invalidateQueries({ queryKey: sourceKeys.list() });
            void queryClient.invalidateQueries({ queryKey: sourceKeys.detail(savedSource.id) });
            pushToast(isCreateMode ? "Source created." : "Source updated.", "success");
            setEditOpen(false);
            void navigate(`/sources/${savedSource.id}`);
        },
    });
    const deleteMutation = useMutation({
        mutationFn: deleteSource,
        onError() {
            pushToast("Could not delete the source.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: sourceKeys.list() });
            pushToast("Source deleted.", "success");
            void navigate("/sources");
        },
    });
    const previewMutation = useMutation({
        mutationFn: () => previewExtraction({
            fields: selectorFields.map(draftToSelector).filter((field) => field.name !== ""),
            url: previewUrl,
        }),
        onSuccess(result) {
            setPreviewMap(buildPreviewFieldMap(result.fields));
            setPreviewFailures(result.failures ?? []);
        },
        onError() {
            setPreviewMap(new Map());
            setPreviewFailures(["Preview could not be loaded. Check the page URL and selectors, then try again."]);
        },
    });
    const sourceHealthQuery = useQuery({
        enabled: !isCreateMode && sourceId !== undefined,
        queryFn: async () => {
            const properties = (await listProperties()).filter((property) => property.source_id === sourceId);
            const snapshotSets = await Promise.all(properties.map(async (property) => ({
                property,
                snapshots: await listPropertySnapshots(property.id, 8),
            })));

            return buildSourceHealthSnapshot(snapshotSets, selectorFields.map(draftToSelector));
        },
        queryKey: ["source-health", sourceId ?? "new"],
    });
    const fieldDefinitionsQuery = useQuery({
        queryFn: listFields,
        queryKey: fieldKeys.list(),
    });

    useEffect(() => {
        if (sourceQuery.data !== undefined) {
            setFormState({
                ...sourceQuery.data,
                config_json: sourceQuery.data.config_json ?? stringifySelectorConfigJson([]),
            });

            try {
                const parsedFields = parseSelectorConfigJson(sourceQuery.data.config_json ?? stringifySelectorConfigJson([]));
                setSelectorFields(parsedFields.length > 0 ? parsedFields.map(selectorToDraft) : createDefaultSelectorDrafts());
                setConfigError(null);
            } catch {
                setSelectorFields(createDefaultSelectorDrafts());
                setConfigError("This template uses an older format. Please review and re-save the template to convert it to the new selector structure.");
            }

            return;
        }

        if (isCreateMode) {
            setFormState(defaultSourceState());
            setSelectorFields(createDefaultSelectorDrafts());
            setConfigError(null);
        }
    }, [isCreateMode, sourceQuery.data]);

    const selectedFields = useMemo(() => {
        return selectorFields
            .map(draftToSelector)
            .filter((field) => field.name !== "");
    }, [selectorFields]);
    const validationMessages = useMemo(() => validateSelectorDrafts(selectorFields), [selectorFields]);
    const fieldRows = selectorFields
        .filter((field) => field.name.trim() !== "")
        .map((field) => {
            const extractionMethod = getExtractionMethodLabel(field);

            return {
                draft: field,
                extractionMethod,
                id: field.id,
                matchStatus: previewMap.get(field.name.trim())?.success === true ? "Matched" : previewMap.has(field.name.trim()) ? "Unmatched" : "Not tested",
                mode: field.extractionMode,
                name: field.name,
                required: field.required ? "Required" : "Optional",
                role: field.fieldRole === "tracked" ? "Tracked" : "Prefill",
                roleValue: field.fieldRole,
                selector: field.selectorValue,
                sourceStatus: field.fieldName.trim() !== "" ? "Mapped" : extractionMethod === "Direct Mapping" ? "Direct" : "Derived",
                sourceStatusValue: field.fieldName.trim() !== "" ? "mapped" : extractionMethod === "Direct Mapping" ? "direct" : "derived",
            };
        });
    const filteredFieldRows = fieldRows.filter((row) => {
        const matchesSearch = fieldSearch.trim() === "" || row.name.toLowerCase().includes(fieldSearch.trim().toLowerCase());
        const matchesStatus = fieldFilter === "all" || row.sourceStatusValue === fieldFilter || row.matchStatus.toLowerCase().replace(" ", "-") === fieldFilter;

        return matchesSearch && matchesStatus;
    });
    const hasPrefillFields = fieldRows.some((row) => row.roleValue === "prefill");
    const hasTrackedFields = fieldRows.some((row) => row.roleValue === "tracked");
    const noPrefillMessage = hasPrefillFields
        ? null
        : <p className={"muted-copy"}>{"No prefill fields yet. Add stable listing facts if you want faster property creation from a URL."}</p>;
    const noTrackedMessage = hasTrackedFields
        ? null
        : <p className={"muted-copy"}>{"No tracked fields yet. Add price or another live signal before relying on this template for monitoring."}</p>;

    const persistFields = (nextFields: SelectorFieldDraft[]): void => {
        setSelectorFields(nextFields);
        if (!isCreateMode) {
            const persistable = nextFields
                .map(draftToSelector)
                .filter((field) => field.name !== "");
            saveMutation.mutate({
                ...formState,
                config_json: stringifySelectorConfigJson(persistable),
            });
        }
    };

    const handleFieldSave = (draft: SelectorFieldDraft): void => {
        if (fieldEditor === null) {
            return;
        }

        if (fieldEditor.mode === "add") {
            persistFields([...selectorFields, { ...draft, id: draft.id !== "" ? draft.id : createEmptySelectorDraft().id }]);
        } else {
            persistFields(selectorFields.map((field) => field.id === fieldEditor.targetId ? { ...draft, id: field.id } : field));
        }

        setFieldEditor(null);
    };

    const handleFieldDelete = (): void => {
        if (fieldDeleteName === null) {
            return;
        }

        persistFields(selectorFields.filter((field) => field.name !== fieldDeleteName));
        setFieldDeleteName(null);
    };

    const editorContent = (
        <PageStack>
            <PageCard
                action={isCreateMode ? <Button as={Link} to={"/sources"} variant={"secondary"}>{"Back to templates"}</Button> : undefined}
                description={"Build a reusable template that both speeds up property intake and defines which fields stay under live monitoring."}
                title={isCreateMode ? "Create Template" : `Edit ${formState.name}`}
            >
                {sourceQuery.isLoading ? <p className={"muted-copy"}>{"Loading template..."}</p> : null}
                {sourceQuery.isError ? <ErrorBanner>{"Could not load the selected template."}</ErrorBanner> : null}
                {configError !== null ? <ErrorBanner>{configError}</ErrorBanner> : null}
                <FormGrid
                    onSubmit={(event) => {
                        event.preventDefault();
                        saveMutation.mutate({
                            ...formState,
                            config_json: stringifySelectorConfigJson(selectedFields),
                        });
                    }}
                >
                    <div className={"selector-builder__identity-grid"}>
                        <Field label={"Template id"}>
                            <Input disabled={!isCreateMode} onChange={(event) => { setFormState((previous) => ({ ...previous, id: event.target.value })); }} value={formState.id} />
                        </Field>
                        <Field label={"Template name"}>
                            <Input onChange={(event) => { setFormState((previous) => ({ ...previous, name: event.target.value })); }} placeholder={"Search results template"} value={formState.name} />
                        </Field>
                        {isCreateMode ? (
                            <Field hint={"Use any page that matches this template to confirm the selectors before saving."} label={"Preview URL"}>
                                <Input onChange={(event) => { setPreviewUrl(event.target.value); }} placeholder={"https://example.com/property"} type={"url"} value={previewUrl} />
                            </Field>
                        ) : null}
                    </div>

                    {isCreateMode ? 
                        <SelectorBuilder fieldDefinitions={fieldDefinitionsQuery.data} fields={selectorFields} onChange={setSelectorFields} previewByFieldName={previewMap} />
                        : null}

                    <ActionGroup className={"source-template-editor-actions"}>
                        {isCreateMode ? (
                            <>
                                <Button onClick={() => { setSelectorFields((currentFields) => [...currentFields, createEmptySelectorDraft()]); }} variant={"secondary"}>{"Add field"}</Button>
                                <Button disabled={previewUrl.trim() === "" || validationMessages.length > 0} isLoading={previewMutation.isPending} onClick={() => { previewMutation.mutate(); }} variant={"secondary"}>
                                    {previewMutation.isPending ? "Checking..." : "Preview template"}
                                </Button>
                            </>
                        ) : null}
                        <Button disabled={formState.id.trim() === "" || formState.name.trim() === "" || (isCreateMode && validationMessages.length > 0)} isLoading={saveMutation.isPending} type={"submit"}>
                            {saveMutation.isPending ? "Saving..." : isCreateMode ? "Create template" : "Save template"}
                        </Button>
                    </ActionGroup>
                    {isCreateMode && validationMessages.length > 0 ? (
                        <div className={"selector-builder__validation-list"}>
                            {validationMessages.map((message) => <ErrorBanner key={message}>{message}</ErrorBanner>)}
                        </div>
                    ) : null}
                    {saveMutation.isError ? <ErrorBanner>{"Could not save the template. Review the names and selectors, then try again."}</ErrorBanner> : null}
                </FormGrid>
            </PageCard>

            <PageCard description={"Preview results update the field cards above so you can see what is ready and what needs attention."} title={"Validation"}>
                {previewFailures.length === 0 ? <p className={"muted-copy"}>{"Preview a page to verify that each field finds the right value."}</p> : (
                    <div className={"selector-builder__validation-list"}>
                        {previewFailures.map((failure) => <ErrorBanner key={failure}>{failure}</ErrorBanner>)}
                    </div>
                )}
            </PageCard>
        </PageStack>
    );

    if (isCreateMode) {
        return editorContent;
    }

    return (
        <>
            <PageStack>
                <PageCard
                    action={(
                        <ActionGroup>
                            <Button as={Link} to={"/sources"} variant={"secondary"}>{"Back"}</Button>
                            <Button onClick={() => { setEditOpen(true); }} variant={"secondary"}>{"Edit"}</Button>
                            <Button onClick={() => { setDeleteOpen(true); }} variant={"secondary"}>{"Delete"}</Button>
                        </ActionGroup>
                    )}
                    description={"Templates stay read-first by default so operators can scan metadata before opening the modal editor."}
                    title={formState.name === "" ? formState.id : formState.name}
                >
                    <KeyValueGrid compact>
                        <KeyValuePair label={"Template id"} value={formState.id} />
                        <KeyValuePair label={"Status"} value={<StatusBadge tone={formState.active === false ? "danger" : "success"} value={formState.active === false ? "inactive" : "active"} />} />
                        <KeyValuePair label={"Created"} value={sourceQuery.data?.created_at === undefined ? "—" : formatDateTime(sourceQuery.data.created_at)} />
                        <KeyValuePair label={"Updated"} value={sourceQuery.data?.updated_at === undefined ? "—" : formatDateTime(sourceQuery.data.updated_at)} />
                    </KeyValueGrid>
                </PageCard>

                <PageCard description={"Track which properties depend on this template, how often their runs succeed, and whether monitoring health differs from intake coverage."} title={"Source Health"}>
                    {sourceHealthQuery.isLoading ? <p className={"muted-copy"}>{"Loading source health..."}</p> : null}
                    {sourceHealthQuery.isError ? <ErrorBanner>{"Could not load source health."}</ErrorBanner> : null}
                    {sourceHealthQuery.data !== undefined ? (
                        <>
                            <KeyValueGrid compact>
                                <KeyValuePair label={"Affected properties"} value={`${sourceHealthQuery.data.affectedProperties}`} />
                                <KeyValuePair label={"Success rate"} value={`${sourceHealthQuery.data.successRate}%`} />
                                <KeyValuePair label={"Failure rate"} value={`${sourceHealthQuery.data.failureRate}%`} />
                                <KeyValuePair label={"Tracked field health"} value={`${sourceHealthQuery.data.trackedFieldHealth}%`} />
                                <KeyValuePair label={"Prefill coverage"} value={`${sourceHealthQuery.data.prefillCoverage}%`} />
                            </KeyValueGrid>
                            <div className={"property-detail-group-grid"} style={{ marginTop: "1rem" }}>
                                <div className={"property-inline-note"}>
                                    <strong>{"Tracked field health"}</strong>
                                    <span>{"Shows whether live monitoring fields are still extracting reliably across recent runs."}</span>
                                </div>
                                <div className={"property-inline-note"}>
                                    <strong>{"Prefill coverage"}</strong>
                                    <span>{"Shows how often intake-oriented listing facts are available when this template is used."}</span>
                                </div>
                            </div>
                            <DataTable
                                caption={"Field completeness by template field"}
                                columns={[
                                    { cell: (item) => item.field, header: "Field", id: "field", sortValue: (item) => item.field },
                                    { cell: (item) => item.role === "tracked" ? "Tracked" : "Prefill", header: "Role", id: "role", sortValue: (item) => item.role },
                                    { cell: (item) => `${item.completeness}%`, header: "Completeness", id: "completeness", sortValue: (item) => item.completeness },
                                    { cell: (item) => `${item.emptyCount}`, header: "Empty results", id: "emptyCount", sortValue: (item) => item.emptyCount },
                                ]}
                                compact
                                emptyMessage={"No source health metrics are available yet."}
                                getRowId={(item) => item.field}
                                items={sourceHealthQuery.data.fields}
                                pageSize={6}
                            />
                        </>
                    ) : null}
                </PageCard>

                <PageCard
                    action={(
                        <Button iconBefore={<Icon name={"plus"} />} onClick={() => { setFieldEditor({ initial: createEmptySelectorDraft(), mode: "add" }); }} variant={"secondary"}>
                            {"Add field"}
                        </Button>
                    )}
                    description={"Configured fields are listed below. Use the row actions to classify and change a single field without opening the full editor."}
                    title={"Configured Fields"}
                >
                    {noPrefillMessage}
                    {noTrackedMessage}
                    <FormGrid as={"div"} className={"source-template-field-controls"} variant={"inline"}>
                        <Field label={"Filter fields"}>
                            <Select onChange={(event) => { setFieldFilter(event.target.value); }} value={fieldFilter}>
                                <option value={"all"}>{"All fields"}</option>
                                <option value={"mapped"}>{"Mapped fields"}</option>
                                <option value={"direct"}>{"Direct fields"}</option>
                                <option value={"derived"}>{"Derived / extracted fields"}</option>
                                <option value={"matched"}>{"Preview matched"}</option>
                                <option value={"unmatched"}>{"Preview unmatched"}</option>
                                <option value={"not-tested"}>{"Not tested"}</option>
                            </Select>
                        </Field>
                        <Field label={"Search by field name"}>
                            <Input onChange={(event) => { setFieldSearch(event.target.value); }} placeholder={"price, area, location"} value={fieldSearch} />
                        </Field>
                        <Field label={"Preview URL"}>
                            <Input onChange={(event) => { setPreviewUrl(event.target.value); }} placeholder={"https://example.com/property"} type={"url"} value={previewUrl} />
                        </Field>
                    </FormGrid>
                    <DataTable
                        caption={"Configured source fields"}
                        columns={[
                            { cell: (item) => item.name, header: "Field", id: "name", sortValue: (item) => item.name },
                            { cell: (item) => <StatusBadge tone={item.sourceStatusValue === "derived" ? "warning" : item.sourceStatusValue === "mapped" ? "success" : "neutral"} value={item.sourceStatus} />, header: "Source mapping", id: "sourceStatus", sortValue: (item) => item.sourceStatus },
                            { cell: (item) => item.extractionMethod, header: "Extraction method", id: "extractionMethod", sortValue: (item) => item.extractionMethod },
                            { cell: (item) => <StatusBadge tone={item.matchStatus === "Matched" ? "success" : item.matchStatus === "Unmatched" ? "warning" : "neutral"} value={item.matchStatus} />, header: "Match status", id: "matchStatus", sortValue: (item) => item.matchStatus },
                            { cell: (item) => `${item.role} · ${item.required}`, header: "Role", id: "role", sortValue: (item) => item.role },
                            { cell: (item) => item.selector, header: "Selector", id: "selector", wrap: true },
                            {
                                align: "right",
                                cell: (item) => (
                                    <RowActions>
                                        <button
                                            aria-label={`Test field ${item.name}`}
                                            className={"icon-button"}
                                            disabled={previewUrl.trim() === "" || validationMessages.length > 0}
                                            onClick={() => { previewMutation.mutate(); }}
                                            title={"Test field"}
                                            type={"button"}
                                        >
                                            <Icon name={"play"} />
                                        </button>
                                        <button
                                            aria-label={`Edit field ${item.name}`}
                                            className={"icon-button"}
                                            onClick={() => { setFieldEditor({ initial: item.draft, mode: "edit", targetId: item.id }); }}
                                            title={"Edit field"}
                                            type={"button"}
                                        >
                                            <Icon name={"edit"} />
                                        </button>
                                        <button
                                            aria-label={`Delete field ${item.name}`}
                                            className={"icon-button icon-button--danger"}
                                            onClick={() => { setFieldDeleteName(item.name); }}
                                            title={"Delete field"}
                                            type={"button"}
                                        >
                                            <Icon name={"trash"} />
                                        </button>
                                    </RowActions>
                                ),
                                header: "Actions",
                                id: "actions",
                                width: "8rem",
                            },
                        ]}
                        compact
                        emptyMessage={"No selector fields are configured yet."}
                        getRowId={(item) => item.id}
                        items={filteredFieldRows}
                        pageSize={12}
                    />
                </PageCard>
            </PageStack>

            <Dialog onOpenChange={setEditOpen} open={editOpen} title={"Edit source"}>
                {editorContent}
            </Dialog>
            <ConfirmDialog
                confirmLabel={"Delete source"}
                description={`Delete ${formState.name}? This removes the source and any related ingestion artifacts.`}
                isPending={deleteMutation.isPending}
                onConfirm={() => {
                    deleteMutation.mutate(formState.id);
                }}
                onOpenChange={setDeleteOpen}
                open={deleteOpen}
                title={"Delete source"}
            />
            <FieldEditorDialog
                fieldDefinitions={fieldDefinitionsQuery.data}
                initialField={fieldEditor?.initial}
                isSaving={saveMutation.isPending}
                onClose={() => { setFieldEditor(null); }}
                onSave={handleFieldSave}
                open={fieldEditor !== null}
                title={fieldEditor?.mode === "edit" ? "Edit field" : "Add field"}
            />
            <ConfirmDialog
                confirmLabel={"Delete field"}
                description={fieldDeleteName === null ? "" : `Delete the "${fieldDeleteName}" field from this template? Existing snapshots remain unchanged.`}
                isPending={saveMutation.isPending}
                onConfirm={handleFieldDelete}
                onOpenChange={(open) => { if (!open) { setFieldDeleteName(null); } }}
                open={fieldDeleteName !== null}
                title={"Delete field"}
            />
        </>
    );
};

const buildSourceHealthSnapshot = (items: { property: { id: string; }; snapshots: PropertySnapshot[]; }[], configuredFields: ReturnType<typeof draftToSelector>[]): {
    readonly affectedProperties: number;
    readonly failureRate: number;
    readonly prefillCoverage: number;
    readonly fields: { completeness: number; emptyCount: number; field: string; role: "prefill" | "tracked"; }[];
    readonly successRate: number;
    readonly trackedFieldHealth: number;
} => {
    const totalSnapshots = items.flatMap((item) => item.snapshots);
    const successCount = totalSnapshots.filter((snapshot) => snapshot.is_valid).length;
    const failureCount = totalSnapshots.length - successCount;
    const fieldStats = new Map<string, { emptyCount: number; seenCount: number; }>();

    totalSnapshots.forEach((snapshot) => {
        Object.entries(snapshot.values).forEach(([field, value]) => {
            const current = fieldStats.get(field) ?? { emptyCount: 0, seenCount: 0 };
            current.seenCount += 1;
            if (value.trim() === "") {
                current.emptyCount += 1;
            }

            fieldStats.set(field, current);
        });
    });

    const rolesByField = new Map(configuredFields.map((field) => [field.name, getSelectorRole(field.field_role)]));
    const fields = [...fieldStats.entries()].map(([field, stat]) => ({
        completeness: stat.seenCount === 0 ? 0 : Math.round(((stat.seenCount - stat.emptyCount) / stat.seenCount) * 100),
        emptyCount: stat.emptyCount,
        field,
        role: rolesByField.get(field) ?? (field === "price" ? "tracked" as const : "prefill" as const),
    }));
    const trackedFields = fields.filter((field) => field.role === "tracked");
    const prefillFields = fields.filter((field) => field.role === "prefill");
    const trackedFieldHealth = trackedFields.length === 0
        ? 0
        : Math.round(trackedFields.reduce((sum, item) => sum + item.completeness, 0) / trackedFields.length);
    const prefillCoverage = prefillFields.length === 0
        ? 0
        : Math.round(prefillFields.reduce((sum, item) => sum + item.completeness, 0) / prefillFields.length);

    return {
        affectedProperties: items.length,
        failureRate: totalSnapshots.length === 0 ? 0 : Math.round((failureCount / totalSnapshots.length) * 100),
        fields,
        prefillCoverage,
        successRate: totalSnapshots.length === 0 ? 0 : Math.round((successCount / totalSnapshots.length) * 100),
        trackedFieldHealth,
    };
};
