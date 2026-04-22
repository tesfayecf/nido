/* eslint-disable react/jsx-props-no-spreading */
import type { SVGProps } from "react";

import { classNames } from "@/lib/ui/classNames";

type IconName = "chevron-down" | "close" | "moon" | "plus" | "search" | "sun";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
    readonly className?: string;
    readonly name: IconName;
    readonly title?: string;
}

const paths: Record<IconName, JSX.Element> = {
    "chevron-down": <path d={"M6 9l6 6 6-6"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    close: <path d={"M6 6l12 12M18 6 6 18"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    moon: <path d={"M15.5 3.5A7 7 0 1 0 20.5 16 8 8 0 1 1 15.5 3.5Z"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    plus: <path d={"M12 5v14M5 12h14"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    search: <path d={"m17 17 3.5 3.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    sun: <path d={"M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
};

export const Icon = ({ className, name, title, ...restProps }: IconProps): JSX.Element => {
    return (
        <svg
            {...restProps}
            aria-hidden={title === undefined}
            className={classNames("icon", className)}
            fill={"none"}
            viewBox={"0 0 24 24"}
        >
            {title !== undefined ? <title>{title}</title> : null}
            {paths[name]}
        </svg>
    );
};
