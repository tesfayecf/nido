import type { PropsWithChildren, ReactNode } from "react";

interface PageCardProps extends PropsWithChildren {
    readonly action?: ReactNode;
    readonly description?: string;
    readonly title: string;
}

/**
 * Renders a reusable dense panel used throughout the first iteration.
 *
 * @param props The card title, optional description, optional action, and content.
 * @returns A styled information panel.
 */
export const PageCard = ({ action, children, description, title }: PageCardProps): JSX.Element => {
    return (
        <section className={"page-card"}>
            <header className={"page-card__header"}>
                <div>
                    <h2 className={"page-card__title"}>{title}</h2>
                    {description !== undefined ? <p className={"page-card__description"}>{description}</p> : null}
                </div>
                {action !== undefined ? <div className={"page-card__action"}>{action}</div> : null}
            </header>
            <div className={"page-card__body"}>{children}</div>
        </section>
    );
};