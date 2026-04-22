/* eslint-disable react/jsx-props-no-spreading */
import type { HTMLAttributes } from "react";

import { classNames } from "@/lib/ui/classNames";

interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
    readonly rounded?: boolean;
}

export const Skeleton = ({ className, rounded = false, ...restProps }: SkeletonProps): JSX.Element => {
    return <span {...restProps} className={classNames("skeleton", rounded && "skeleton--rounded", className)} />;
};
