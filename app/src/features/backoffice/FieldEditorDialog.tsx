import { useEffect, useState } from "react";

import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SelectorBuilder } from "@/components/selectors/SelectorBuilder";
import type { FieldDefinitionUsage } from "@/services/fields/fields.types";
import {
    createEmptySelectorDraft,
    draftToSelector,
    validateSelectorDrafts,
    type SelectorFieldDraft,
} from "@/features/selectors/selectorSchema";

interface FieldEditorDialogProps {
    readonly fieldDefinitions?: FieldDefinitionUsage[];
    readonly initialField?: SelectorFieldDraft;
    readonly isSaving?: boolean;
    readonly onClose: () => void;
    readonly onSave: (field: SelectorFieldDraft) => void;
    readonly open: boolean;
    readonly title: string;
}

/**
 * Modal that captures or edits a single SelectorFieldDraft using the standard
 * SelectorBuilder UI. Used by the source detail page to add or amend one field
 * at a time without opening the full template editor.
 */
export const FieldEditorDialog = ({
    fieldDefinitions,
    initialField,
    isSaving = false,
    onClose,
    onSave,
    open,
    title,
}: FieldEditorDialogProps): JSX.Element => {
    const [draft, setDraft] = useState<SelectorFieldDraft>(initialField ?? createEmptySelectorDraft());

    useEffect(() => {
        if (open) {
            setDraft(initialField ?? createEmptySelectorDraft());
        }
    }, [initialField, open]);

    const messages = validateSelectorDrafts([draft]);
    const ready = draft.name.trim() !== "" && messages.length === 0;

    return (
        <Dialog
            actions={(
                <>
                    <Button onClick={onClose} variant={"secondary"}>{"Cancel"}</Button>
                    <Button
                        disabled={!ready}
                        isLoading={isSaving}
                        onClick={() => {
                            // Verify before save so callers get a clean selector payload.
                            const sanitized = draftToSelector(draft);
                            if (sanitized.name === "") {
                                return;
                            }

                            onSave(draft);
                        }}
                    >
                        {"Save field"}
                    </Button>
                </>
            )}
            className={"dialog--wide"}
            description={"Configure a single selector field. Changes apply to the current source template once saved."}
            onOpenChange={(value) => { if (!value) { onClose(); } }}
            open={open}
            title={title}
        >
            <SelectorBuilder fieldDefinitions={fieldDefinitions} fields={[draft]} onChange={(updater) => {
                setDraft((current) => {
                    const next = typeof updater === "function" ? updater([current])[0] : updater[0];
                    return next ?? current;
                });
            }}
            />
            {messages.length > 0 ? (
                <div className={"selector-builder__validation-list"}>
                    {messages.map((message) => <ErrorBanner key={message}>{message}</ErrorBanner>)}
                </div>
            ) : null}
            <ActionGroup>
                <span className={"muted-copy"}>{"Field name and a valid selector are required before saving."}</span>
            </ActionGroup>
        </Dialog>
    );
};
