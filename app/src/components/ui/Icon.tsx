/* eslint-disable react/jsx-props-no-spreading */
import type { SVGProps } from "react";

import { classNames } from "@/lib/ui/classNames";

type IconName =
    | "bell"
    | "bookmark"
    | "bookmark-filled"
    | "chevron-down"
    | "clock"
    | "close"
    | "edit"
    | "external"
    | "history"
    | "more-horizontal"
    | "moon"
    | "play"
    | "plus"
    | "search"
    | "sidebar"
    | "sources"
    | "sun"
    | "trash";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
    readonly className?: string;
    readonly name: IconName;
    readonly title?: string;
}

const paths: Record<IconName, JSX.Element> = {
    bell: <path d={"M6 8a6 6 0 1 1 12 0v3.5l1.5 3H4.5L6 11.5V8Zm3.5 9.5a2.5 2.5 0 0 0 5 0"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    bookmark: <path d={"M6 4h12v17l-6-4-6 4V4Z"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    "bookmark-filled": <path d={"M6 4h12v17l-6-4-6 4V4Z"} fill={"currentColor"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    "chevron-down": <path d={"M6 9l6 6 6-6"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    clock: <path d={"M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    close: <path d={"M6 6l12 12M18 6 6 18"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    edit: <path d={"M4 20h4l11-11-4-4L4 16v4Zm10-14 4 4"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    external: <path d={"M14 4h6v6M20 4 10 14M18 14v6H4V6h6"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    history: <path d={"M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    "more-horizontal": <path d={"M6 12h.01M12 12h.01M18 12h.01"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={2.5} />,
    moon: <path d={"M15.5 3.5A7 7 0 1 0 20.5 16 8 8 0 1 1 15.5 3.5Z"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    play: <path d={"M7 5v14l11-7L7 5Z"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    plus: <path d={"M12 5v14M5 12h14"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    search: <path d={"m17 17 3.5 3.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    sidebar: <path d={"M4 5h16v14H4V5Zm5 0v14"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    sources: <path d={"M4 6h16M4 12h16M4 18h10"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    sun: <path d={"M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
    trash: <path d={"M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7h10ZM10 11v6M14 11v6"} fill={"none"} stroke={"currentColor"} strokeLinecap={"round"} strokeLinejoin={"round"} strokeWidth={1.75} />,
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
