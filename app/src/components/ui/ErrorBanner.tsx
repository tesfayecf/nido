import type { PropsWithChildren } from "react";

import { classNames } from "@/lib/ui/classNames";

interface ErrorBannerProps extends PropsWithChildren {
    readonly className?: string;
}

export const ErrorBanner = ({ children, className }: ErrorBannerProps): JSX.Element => {
    return <p className={classNames("error-banner", className)} role={"alert"}>{children}</p>;
};
