import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { SelectorBuilder } from "@/components/selectors/SelectorBuilder";
import { PageCard } from "@/components/ui/PageCard";
import { formatDateTime } from "@/lib/format/date";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { deleteSource, getSource, upsertSource } from "@/services/backoffice-sources/sources.service";
import type { Source } from "@/services/backoffice-sources/sources.types";
import { previewExtraction } from "@/services/properties/properties.service";
import type { PropertyPreviewFieldResult } from "@/services/properties/properties.types";
import {
    buildPreviewFieldMap,
    createEmptySelectorDraft,
    draftToSelector,
    parseSelectorConfigJson,
    selectorToDraft,
    stringifySelectorConfigJson,
    validateSelectorDrafts,
    type SelectorFieldDraft,
} from "@/features/selectors/selectorSchema";

const defaultTemplateFields = (): SelectorFieldDraft[] => [
    { ...createEmptySelectorDraft(), name: "price", required: true },
    { ...createEmptySelectorDraft(), name: "title" },
    { ...createEmptySelectorDraft(), name: "location" },
];

const defaultSourceState = (): Source => ({
    config_json: stringifySelectorConfigJson(defaultTemplateFields().map(draftToSelector)),
    id: "",
    name: "",
});

export const SourceDetailPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { sourceId } = useParams();
    const isCreateMode = sourceId === undefined;
    const sourceQuery = useQuery({
        enabled: sourceId !== undefined,
        queryFn: () => getSource(sourceId ?? ""),
        queryKey: sourceKeys.detail(sourceId ?? "new"),
    });
    const [formState, setFormState] = useState<Source>(defaultSourceState);
    const [previewUrl, setPreviewUrl] = useState("");
    const [selectorFields, setSelectorFields] = useState<SelectorFieldDraft[]>(defaultTemplateFields);
    const [configError, setConfigError] = useState<string | null>(null);
    const [previewFailures, setPreviewFailures] = useState<string[]>([]);
    const [previewMap, setPreviewMap] = useState<Map<string, PropertyPreviewFieldResult>>(new Map());
    const saveMutation = useMutation({
        mutationFn: upsertSource,
        onSuccess(savedSource) {
            void queryClient.invalidateQueries({ queryKey: sourceKeys.list() });
            void queryClient.invalidateQueries({ queryKey: sourceKeys.detail(savedSource.id) });
            void navigate(`/sources/${savedSource.id}`);
        },
    });
    const deleteMutation = useMutation({
        mutationFn: deleteSource,
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: sourceKeys.list() });
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
                setSelectorFields(parsedFields.length > 0 ? parsedFields.map(selectorToDraft) : defaultTemplateFields());
                setConfigError(null);
            } catch {
                setSelectorFields(defaultTemplateFields());
                setConfigError("This template uses an older format that cannot be shown here yet. Save it again after reviewing the fields below to convert it to the new selector structure.");
            }

            return;
        }

        if (isCreateMode) {
            setFormState(defaultSourceState());
            setSelectorFields(defaultTemplateFields());
            setConfigError(null);
        }
    }, [isCreateMode, sourceQuery.data]);

    const selectedFields = useMemo(() => {
        return selectorFields
            .map(draftToSelector)
            .filter((field) => field.name !== "");
    }, [selectorFields]);
    const validationMessages = useMemo(() => validateSelectorDrafts(selectorFields), [selectorFields]);

    return (
        <div className={"page-stack"}>
            <PageCard
                action={<Link className={"button button--secondary"} to={"/sources"}>{"Back to templates"}</Link>}
                description={"Build a reusable extraction template with clear selectors, fallbacks, and a quick preview."}
                title={isCreateMode ? "Create Template" : `Template ${formState.name}`}
            >
                {sourceQuery.isLoading ? <p className={"muted-copy"}>{"Loading template..."}</p> : null}
                {sourceQuery.isError ? <p className={"error-banner"}>{"Could not load the selected template."}</p> : null}
                {configError !== null ? <p className={"error-banner"}>{configError}</p> : null}
                <form
                    className={"form-grid"}
                    onSubmit={(event) => {
                        event.preventDefault();
                        saveMutation.mutate({
                            ...formState,
                            config_json: stringifySelectorConfigJson(selectedFields),
                        });
                    }}
                >
                    <div className={"selector-builder__identity-grid"}>
                        <label className={"field"}>
                            <span className={"field__label"}>{"Template id"}</span>
                            <input className={"field__control"} disabled={!isCreateMode} onChange={(event) => { setFormState((previous) => ({ ...previous, id: event.target.value })); }} value={formState.id} />
                        </label>
                        <label className={"field"}>
                            <span className={"field__label"}>{"Template name"}</span>
                            <input className={"field__control"} onChange={(event) => { setFormState((previous) => ({ ...previous, name: event.target.value })); }} placeholder={"Search results template"} value={formState.name} />
                        </label>
                        <label className={"field"}>
                            <span className={"field__label"}>{"Preview URL"}</span>
                            <input className={"field__control"} onChange={(event) => { setPreviewUrl(event.target.value); }} placeholder={"https://example.com/property"} type={"url"} value={previewUrl} />
                            <p className={"field__hint"}>{"Use any page that matches this template to confirm the selectors before saving."}</p>
                        </label>
                    </div>

                    <SelectorBuilder fields={selectorFields} onChange={setSelectorFields} previewByFieldName={previewMap} />

                    <div className={"action-group"}>
                        <button className={"button button--secondary"} onClick={() => { setSelectorFields((currentFields) => [...currentFields, createEmptySelectorDraft()]); }} type={"button"}>{"Add field"}</button>
                        <button className={"button button--secondary"} disabled={previewMutation.isPending || previewUrl.trim() === "" || validationMessages.length > 0} onClick={() => { previewMutation.mutate(); }} type={"button"}>
                            {previewMutation.isPending ? "Checking..." : "Preview template"}
                        </button>
                        <button className={"button"} disabled={saveMutation.isPending || formState.id.trim() === "" || formState.name.trim() === "" || validationMessages.length > 0} type={"submit"}>
                            {saveMutation.isPending ? "Saving..." : isCreateMode ? "Create template" : "Save template"}
                        </button>
                        {!isCreateMode ? <button className={"button button--secondary"} disabled={deleteMutation.isPending} onClick={() => { deleteMutation.mutate(formState.id); }} type={"button"}>{"Delete template"}</button> : null}
                    </div>
                    {validationMessages.length > 0 ? (
                        <div className={"selector-builder__validation-list"}>
                            {validationMessages.map((message) => <p className={"error-banner"} key={message}>{message}</p>)}
                        </div>
                    ) : null}
                    {saveMutation.isError ? <p className={"error-banner"}>{"Could not save the template. Review the names and selectors, then try again."}</p> : null}
                </form>
            </PageCard>

            <PageCard description={"Preview results update the field cards above so you can see what is ready and what needs attention."} title={"Validation"}>
                {previewFailures.length === 0 ? (
                    <p className={"muted-copy"}>{"Preview a page to verify that each field finds the right value."}</p>
                ) : (
                    <div className={"selector-builder__validation-list"}>
                        {previewFailures.map((failure) => <p className={"error-banner"} key={failure}>{failure}</p>)}
                    </div>
                )}
            </PageCard>

            {!isCreateMode && sourceQuery.data !== undefined ? (
                <PageCard description={"Timestamps come directly from the saved template record."} title={"Metadata"}>
                    <div className={"key-value-grid"}>
                        <div>
                            <span className={"key-value-grid__label"}>{"Created at"}</span>
                            <strong className={"key-value-grid__value"}>{sourceQuery.data.created_at === undefined ? "—" : formatDateTime(sourceQuery.data.created_at)}</strong>
                        </div>
                        <div>
                            <span className={"key-value-grid__label"}>{"Updated at"}</span>
                            <strong className={"key-value-grid__value"}>{sourceQuery.data.updated_at === undefined ? "—" : formatDateTime(sourceQuery.data.updated_at)}</strong>
                        </div>
                    </div>
                </PageCard>
            ) : null}
        </div>
    );
};
