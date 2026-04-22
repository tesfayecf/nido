import { classNames } from "@/lib/ui/classNames";

interface InlineSpinnerProps {
    readonly className?: string;
    readonly label?: string;
}

export const InlineSpinner = ({ className, label = "Loading" }: InlineSpinnerProps): JSX.Element => {
    return (
        <span
            aria-label={label}
            className={classNames("inline-spinner", className)}
            role={"status"}
        />
    );
};
