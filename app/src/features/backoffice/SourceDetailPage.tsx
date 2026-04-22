import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { SelectorBuilder } from "@/components/selectors/SelectorBuilder";
import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
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

    return (
        <PageStack>
            <PageCard
                action={<Button as={Link} to={"/sources"} variant={"secondary"}>{"Back to templates"}</Button>}
                description={"Build a reusable extraction template with clear selectors, fallbacks, and a quick preview."}
                title={isCreateMode ? "Create Template" : `Template ${formState.name}`}
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
                        {!isCreateMode ? <Button disabled={deleteMutation.isPending} onClick={() => { deleteMutation.mutate(formState.id); }} variant={"secondary"}>{"Delete template"}</Button> : null}
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

            {!isCreateMode && sourceQuery.data !== undefined ? (
                <PageCard description={"Timestamps come directly from the saved template record."} title={"Metadata"}>
                    <KeyValueGrid>
                        <KeyValuePair label={"Created at"} value={sourceQuery.data.created_at === undefined ? "—" : formatDateTime(sourceQuery.data.created_at)} />
                        <KeyValuePair label={"Updated at"} value={sourceQuery.data.updated_at === undefined ? "—" : formatDateTime(sourceQuery.data.updated_at)} />
                    </KeyValueGrid>
                </PageCard>
            ) : null}
        </PageStack>
    );
};
