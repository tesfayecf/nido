import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface ConfirmDialogProps {
    readonly confirmLabel: string;
    readonly description: string;
    readonly isPending?: boolean;
    readonly onConfirm: () => void;
    readonly onOpenChange: (open: boolean) => void;
    readonly open: boolean;
    readonly title: string;
}

export const ConfirmDialog = ({
    confirmLabel,
    description,
    isPending = false,
    onConfirm,
    onOpenChange,
    open,
    title,
}: ConfirmDialogProps): JSX.Element => {
    return (
        <Dialog
            actions={(
                <ActionGroup>
                    <Button onClick={() => { onOpenChange(false); }} variant={"secondary"}>{"Cancel"}</Button>
                    <Button isLoading={isPending} onClick={onConfirm} variant={"destructive"}>{confirmLabel}</Button>
                </ActionGroup>
            )}
            description={description}
            onOpenChange={onOpenChange}
            open={open}
            title={title}
        >
            <p className={"muted-copy"}>{description}</p>
        </Dialog>
    );
};
