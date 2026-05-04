import { useState } from "react";
import type { InputHTMLAttributes } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
    readonly className?: string;
};

export const PasswordInput = ({ className, ...restProps }: PasswordInputProps): JSX.Element => {
    const [visible, setVisible] = useState(false);

    const toggle = (): void => setVisible((v) => !v);
    const label = visible ? "Hide password" : "Show password";

    return (
        <Input
            {...restProps}
            className={className}
            type={visible ? "text" : "password"}
            suffix={(
                <Button
                    aria-pressed={visible}
                    aria-label={label}
                    onClick={toggle}
                    size={"small"}
                    variant={"ghost"}
                >
                    {visible ? "Hide" : "Show"}
                </Button>
            )}
        />
    );
};
