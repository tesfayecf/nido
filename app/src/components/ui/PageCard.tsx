import type { PropsWithChildren, ReactNode } from "react";

import { ContextualHelp } from "@/components/ui/ContextualHelp";

interface PageCardProps extends PropsWithChildren {
    readonly action?: ReactNode;
    readonly description?: string;
    readonly title: string;
    readonly titleId?: string;
}

/**
 * Renders a reusable dense panel used throughout the first iteration.
 *
 * @param props The card title, optional description, optional action, and content.
 * @returns A styled information panel.
 */
export const PageCard = ({ action, children, description, title, titleId }: PageCardProps): JSX.Element => {
    return (
        <section className={"page-card"}>
            <header className={"page-card__header"}>
                <div className={"page-card__heading"}>
                    <div className={"page-card__title-row"}>
                        <h2 className={"page-card__title"} id={titleId}>{title}</h2>
                        {description !== undefined ? <ContextualHelp content={description} title={title} /> : null}
                    </div>
                </div>
                {action !== undefined ? <div className={"page-card__action"}>{action}</div> : null}
            </header>
            <div className={"page-card__body"}>{children}</div>
        </section>
    );
};
