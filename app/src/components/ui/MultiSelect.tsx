import { isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Input } from "@/components/ui/Input";
import { classNames } from "@/lib/ui/classNames";

interface MultiSelectOption {
    readonly description?: ReactNode;
    readonly label: ReactNode;
    readonly value: string;
}

interface MultiSelectProps {
    readonly "aria-labelledby"?: string;
    readonly className?: string;
    readonly disabled?: boolean;
    readonly emptyMessage?: string;
    readonly onChange: (values: string[]) => void;
    readonly options: MultiSelectOption[];
    readonly placeholder?: string;
    readonly searchPlaceholder?: string;
    readonly values: string[];
}

export const MultiSelect = ({
    "aria-labelledby": ariaLabelledBy,
    className,
    disabled = false,
    emptyMessage = "No options found.",
    onChange,
    options,
    placeholder = "Select options",
    searchPlaceholder = "Search options",
    values,
}: MultiSelectProps): JSX.Element => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const rootRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const listboxId = useId();

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handlePointerDown = (event: MouseEvent): void => {
            if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        window.addEventListener("mousedown", handlePointerDown);
        return () => {
            window.removeEventListener("mousedown", handlePointerDown);
        };
    }, [open]);

    useEffect(() => {
        if (!open) {
            setSearch("");
            return undefined;
        }

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const filteredOptions = useMemo(() => {
        if (search.trim() === "") {
            return options;
        }

        const normalizedSearch = search.trim().toLowerCase();
        return options.filter((option) => readOptionText(option).toLowerCase().includes(normalizedSearch));
    }, [options, search]);

    const selectedLabels = options
        .filter((option) => values.includes(option.value))
        .map((option) => readNodeText(option.label))
        .filter((label) => label !== "")
        .join(", ");

    return (
        <div className={classNames("multi-select", className)} ref={rootRef}>
            <button
                aria-controls={listboxId}
                aria-expanded={open}
                aria-haspopup={"listbox"}
                aria-labelledby={ariaLabelledBy}
                className={"multi-select__trigger field__control"}
                disabled={disabled}
                onClick={() => {
                    setOpen((current) => !current);
                }}
                ref={triggerRef}
                type={"button"}
            >
                <span className={values.length === 0 ? "multi-select__placeholder" : undefined}>
                    {values.length === 0 ? placeholder : selectedLabels !== "" ? selectedLabels : `${values.length} selected`}
                </span>
                <span aria-hidden className={"multi-select__count"}>{values.length}</span>
            </button>
            {open ? (
                <div className={"multi-select__panel"}>
                    <Input
                        autoFocus
                        onChange={(event) => {
                            setSearch(event.target.value);
                        }}
                        placeholder={searchPlaceholder}
                        type={"search"}
                        value={search}
                    />
                    <div aria-multiselectable className={"multi-select__options"} id={listboxId} role={"listbox"}>
                        {filteredOptions.length === 0 ? <p className={"multi-select__empty"}>{emptyMessage}</p> : null}
                        {filteredOptions.map((option) => {
                            const selected = values.includes(option.value);
                            return (
                                <button
                                    aria-selected={selected}
                                    className={selected ? "multi-select__option multi-select__option--selected" : "multi-select__option"}
                                    key={option.value}
                                    onClick={() => {
                                        onChange(selected ? values.filter((value) => value !== option.value) : [...values, option.value]);
                                    }}
                                    role={"option"}
                                    type={"button"}
                                >
                                    <span className={"multi-select__label"}>{option.label}</span>
                                    {option.description !== undefined ? <span className={"multi-select__description"}>{option.description}</span> : null}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

const readOptionText = (option: MultiSelectOption): string => {
    return `${readNodeText(option.label)} ${readNodeText(option.description)}`.trim();
};

const readNodeText = (value: ReactNode): string => {
    if (typeof value === "string" || typeof value === "number") {
        return `${value}`;
    }

    if (Array.isArray(value)) {
        return value.map((item) => readNodeText(item)).filter((item) => item !== "").join(" ").trim();
    }

    if (isValidElement<{ children?: ReactNode; }>(value)) {
        return readNodeText(value.props.children ?? "");
    }

    return "";
};
