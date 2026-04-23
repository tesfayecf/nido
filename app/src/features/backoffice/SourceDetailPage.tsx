import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { SelectorBuilder } from "@/components/selectors/SelectorBuilder";
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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { FieldEditorDialog } from "@/features/backoffice/FieldEditorDialog";
import { formatDateTime } from "@/lib/format/date";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { deleteSource, getSource, upsertSource } from "@/services/backoffice-sources/sources.service";
import type { Source } from "@/services/backoffice-sources/sources.types";
import { previewExtraction } from "@/services/properties/properties.service";
import type { PropertyPreviewFieldResult } from "@/services/properties/properties.types";
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
        .map((field) => ({
            draft: field,
            id: field.id,
            mode: field.extractionMode,
            name: field.name,
            required: field.required ? "Required" : "Optional",
            selector: field.selectorValue,
        }));

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
                action={<Button as={Link} to={"/sources"} variant={"secondary"}>{"Back to templates"}</Button>}
                description={"Build a reusable extraction template with clear selectors, fallbacks, and a quick preview."}
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
                        <Field hint={"Use any page that matches this template to confirm the selectors before saving."} label={"Preview URL"}>
                            <Input onChange={(event) => { setPreviewUrl(event.target.value); }} placeholder={"https://example.com/property"} type={"url"} value={previewUrl} />
                        </Field>
                    </div>

                    <SelectorBuilder fields={selectorFields} onChange={setSelectorFields} previewByFieldName={previewMap} />

                    <ActionGroup>
                        <Button onClick={() => { setSelectorFields((currentFields) => [...currentFields, createEmptySelectorDraft()]); }} variant={"secondary"}>{"Add field"}</Button>
                        <Button disabled={previewUrl.trim() === "" || validationMessages.length > 0} isLoading={previewMutation.isPending} onClick={() => { previewMutation.mutate(); }} variant={"secondary"}>
                            {previewMutation.isPending ? "Checking..." : "Preview template"}
                        </Button>
                        <Button disabled={formState.id.trim() === "" || formState.name.trim() === "" || validationMessages.length > 0} isLoading={saveMutation.isPending} type={"submit"}>
                            {saveMutation.isPending ? "Saving..." : isCreateMode ? "Create template" : "Save template"}
                        </Button>
                    </ActionGroup>
                    {validationMessages.length > 0 ? (
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

                <PageCard
                    action={(
                        <Button iconBefore={<Icon name={"plus"} />} onClick={() => { setFieldEditor({ initial: createEmptySelectorDraft(), mode: "add" }); }} variant={"secondary"}>
                            {"Add field"}
                        </Button>
                    )}
                    description={"Configured fields are listed below. Use the row actions to change a single field without opening the full editor."}
                    title={"Configured Fields"}
                >
                    <DataTable
                        caption={"Configured source fields"}
                        columns={[
                            { cell: (item) => item.name, header: "Field", id: "name", sortValue: (item) => item.name },
                            { cell: (item) => item.selector, header: "Selector", id: "selector" },
                            { cell: (item) => item.mode, header: "Mode", id: "mode", sortValue: (item) => item.mode },
                            { cell: (item) => item.required, header: "Required", id: "required", sortValue: (item) => item.required },
                            {
                                align: "right",
                                cell: (item) => (
                                    <RowActions>
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
                        items={fieldRows}
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
