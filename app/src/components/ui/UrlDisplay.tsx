import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";

interface UrlDisplayProps {
    readonly url: string;
    readonly label?: string;
    /** Maximum characters of the URL to render inline before truncating. */
    readonly inlineLength?: number;
}

const truncate = (value: string, length: number): string => {
    if (value.length <= length) {
        return value;
    }

    const head = Math.max(Math.floor(length * 0.6), 12);
    const tail = Math.max(length - head - 1, 6);
    return `${value.slice(0, head)}…${value.slice(-tail)}`;
};

/**
 * Renders a URL inline with smart truncation. Clicking the truncated text
 * opens a modal that reveals the full URL and offers an external open action.
 */
export const UrlDisplay = ({ url, label, inlineLength = 56 }: UrlDisplayProps): JSX.Element => {
    const [open, setOpen] = useState(false);
    const trimmed = url.trim();

    if (trimmed === "") {
        return <span className={"muted-copy"}>{"—"}</span>;
    }

    const truncated = truncate(trimmed, inlineLength);
    const isTruncated = truncated !== trimmed;

    return (
        <>
            <span className={"url-display"}>
                <button
                    aria-label={`Show full URL${label !== undefined ? ` for ${label}` : ""}`}
                    className={"url-display__trigger"}
                    onClick={() => { setOpen(true); }}
                    title={isTruncated ? "Show full URL" : trimmed}
                    type={"button"}
                >
                    {truncated}
                </button>
            </span>
            <Dialog
                actions={(
                    <>
                        <Button onClick={() => { setOpen(false); }} variant={"secondary"}>{"Close"}</Button>
                        <Button
                            as={"a"}
                            href={trimmed}
                            iconBefore={<Icon name={"external"} />}
                            rel={"noreferrer noopener"}
                            target={"_blank"}
                        >
                            {"Open original"}
                        </Button>
                    </>
                )}
                description={"This is the listing URL tracked for the property. Clicks open in a new tab."}
                onOpenChange={setOpen}
                open={open}
                title={label !== undefined ? `URL · ${label}` : "Property URL"}
            >
                <code className={"url-display__full"}>{trimmed}</code>
            </Dialog>
        </>
    );
};
