interface ToggleProps {
    readonly checked: boolean;
    readonly className?: string;
    readonly disabled?: boolean;
    readonly label?: string;
    readonly onCheckedChange: (nextChecked: boolean) => void;
}

export const Toggle = ({
    checked,
    className,
    disabled = false,
    label,
    onCheckedChange,
}: ToggleProps): JSX.Element => {
    return (
        <button
            aria-checked={checked}
            aria-label={label}
            className={className === undefined ? "switch" : `switch ${className}`}
            disabled={disabled}
            onClick={() => {
                onCheckedChange(!checked);
            }}
            role={"switch"}
            type={"button"}
        >
            <span className={checked ? "switch__track switch__track--checked" : "switch__track"}>
                <span className={checked ? "switch__thumb switch__thumb--checked" : "switch__thumb"} />
            </span>
        </button>
    );
};
