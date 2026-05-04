import type { PropsWithChildren, ReactNode } from "react";

import { PageCard } from "@/components/ui/PageCard";

export interface SecondarySurfaceSummaryItem {
    readonly context: ReactNode;
    readonly label: string;
    readonly value: ReactNode;
}

interface SecondarySurfaceHeaderProps extends PropsWithChildren {
    readonly action?: ReactNode;
    readonly description?: string;
    readonly summaryAriaLabel: string;
    readonly summaryItems: readonly SecondarySurfaceSummaryItem[];
    readonly title: string;
}

export const SecondarySurfaceHeader = ({
    action,
    children,
    description,
    summaryAriaLabel,
    summaryItems,
    title,
}: SecondarySurfaceHeaderProps): JSX.Element => {
    return (
        <PageCard action={action} description={description} title={title}>
            <section aria-label={summaryAriaLabel} className={"management-surface__summary"}>
                {summaryItems.map((item) => (
                    <article className={"management-surface__summary-item"} key={item.label}>
                        <span className={"management-surface__summary-label"}>{item.label}</span>
                        <strong className={"management-surface__summary-value"}>{item.value}</strong>
                        <p className={"management-surface__summary-context"}>{item.context}</p>
                    </article>
                ))}
            </section>
            {children !== undefined ? <div className={"management-surface__controls"}>{children}</div> : null}
        </PageCard>
    );
};