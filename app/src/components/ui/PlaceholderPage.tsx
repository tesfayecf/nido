import { Link } from "react-router-dom";

import { PageCard } from "@/components/ui/PageCard";

interface PlaceholderPageProps {
    readonly ctaHref?: string;
    readonly ctaLabel?: string;
    readonly description: string;
    readonly title: string;
}

/**
 * Renders a temporary page shell while a feature is being filled in.
 *
 * The component is intentionally explicit so routes remain wired and visible as
 * the first working slice is expanded incrementally.
 *
 * @param props The page title, description, and optional call to action.
 * @returns A placeholder page card.
 */
export const PlaceholderPage = ({ ctaHref, ctaLabel, description, title }: PlaceholderPageProps): JSX.Element => {
    return (
        <div className={"page-stack"}>
            <PageCard
                action={ctaHref !== undefined && ctaLabel !== undefined ? <Link className={"button button--secondary"} to={ctaHref}>{ctaLabel}</Link> : undefined}
                description={description}
                title={title}
            >
                <p className={"muted-copy"}>
                    {"This route is wired into the first frontend slice and will be filled with the live backend integration in the next implementation step."}
                </p>
            </PageCard>
        </div>
    );
};