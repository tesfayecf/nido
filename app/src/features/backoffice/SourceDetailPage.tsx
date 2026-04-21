import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { PageCard } from "@/components/ui/PageCard";
import { formatDateTime } from "@/lib/format/date";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { deleteSource, getSource, upsertSource } from "@/services/backoffice-sources/sources.service";
import type { Source } from "@/services/backoffice-sources/sources.types";

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
    const [formState, setFormState] = useState<Source>({
        config_json: "[]",
        id: "",
        name: "",
    });
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

    useEffect(() => {
        if (sourceQuery.data !== undefined) {
            setFormState({
                config_json: sourceQuery.data.config_json ?? "[]",
                id: sourceQuery.data.id,
                name: sourceQuery.data.name,
            });
            return;
        }

        if (isCreateMode) {
            setFormState({ config_json: "[]", id: "", name: "" });
        }
    }, [isCreateMode, sourceQuery.data]);

    return (
        <div className={"page-stack"}>
            <PageCard
                action={<Link className={"button button--secondary"} to={"/sources"}>{"Back to sources"}</Link>}
                description={"Define reusable field selectors as JSON. Each item should match the property field selector contract."}
                title={isCreateMode ? "Create Source" : `Source ${formState.name}`}
            >
                {sourceQuery.isLoading ? <p className={"muted-copy"}>{"Loading source..."}</p> : null}
                {sourceQuery.isError ? <p className={"error-banner"}>{"Could not load the selected source."}</p> : null}
                <form
                    className={"form-grid"}
                    onSubmit={(event) => {
                        event.preventDefault();
                        saveMutation.mutate(formState);
                    }}
                >
                    <label className={"field"}>
                        <span className={"field__label"}>{"Id"}</span>
                        <input className={"field__control"} disabled={!isCreateMode} onChange={(event) => { setFormState((previous) => ({ ...previous, id: event.target.value })); }} value={formState.id} />
                    </label>
                    <label className={"field"}>
                        <span className={"field__label"}>{"Name"}</span>
                        <input className={"field__control"} onChange={(event) => { setFormState((previous) => ({ ...previous, name: event.target.value })); }} value={formState.name} />
                    </label>
                    <label className={"field field--full-width"}>
                        <span className={"field__label"}>{"Selectors JSON"}</span>
                        <textarea className={"field__control field__control--textarea"} onChange={(event) => { setFormState((previous) => ({ ...previous, config_json: event.target.value })); }} rows={12} value={formState.config_json ?? "[]"} />
                    </label>
                    <div className={"field field--actions field--full-width"}>
                        <button className={"button"} disabled={saveMutation.isPending} type={"submit"}>{saveMutation.isPending ? "Saving..." : isCreateMode ? "Create source" : "Save source"}</button>
                        {!isCreateMode ? <button className={"button button--secondary"} disabled={deleteMutation.isPending} onClick={() => { deleteMutation.mutate(formState.id); }} type={"button"}>{"Delete source"}</button> : null}
                    </div>
                </form>
            </PageCard>
            {!isCreateMode && sourceQuery.data !== undefined ? (
                <PageCard description={"Timestamps come directly from the backend source record."} title={"Metadata"}>
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
