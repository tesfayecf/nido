import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";

import { PageCard } from "@/components/ui/PageCard";

/**
 * Renders a stable fallback when a routed screen throws during rendering or loading.
 *
 * @returns The route error boundary UI.
 */
export const AppRouteError = (): JSX.Element => {
    const error = useRouteError();

    let title = "Unexpected Error";
    let description = "The requested screen could not be rendered.";
    if (isRouteErrorResponse(error)) {
        title = `${error.status} ${error.statusText}`.trim();
        description = typeof error.data === "string" && error.data.trim() !== ""
            ? error.data
            : "The route failed while loading data or rendering.";
    } else if (error instanceof Error && error.message.trim() !== "") {
        description = error.message;
    }

    return (
        <div className={"page-stack"}>
            <PageCard
                action={<Link className={"button button--secondary"} to={"/listings"}>{"Back to listings"}</Link>}
                description={description}
                title={title}
            >
                <p className={"muted-copy"}>{"Reload the page after the underlying problem is resolved, or return to a stable route."}</p>
            </PageCard>
        </div>
    );
};