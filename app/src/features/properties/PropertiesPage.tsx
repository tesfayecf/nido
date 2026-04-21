import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageCard } from "@/components/ui/PageCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LiveEventsPanel } from "@/features/backoffice/LiveEventsPanel";
import { formatDateTime } from "@/lib/format/date";
import { propertyKeys } from "@/services/properties/properties.keys";
import { ingestProperty, listProperties } from "@/services/properties/properties.service";
import type { PropertyStatus } from "@/services/properties/properties.types";

/**
 * Maps a PropertyStatus value to a StatusBadge tone.
 *
 * @param status The property status string.
 * @returns The badge tone.
 */
const statusTone = (status: PropertyStatus): "danger" | "neutral" | "success" | "warning" => {
    switch (status) {
        case "active":
            return "success";
        case "degraded":
            return "warning";
        case "inactive":
            return "neutral";
        case "pending":
        default:
            return "neutral";
    }
};

/**
 * Hosts the tracked properties list route.
 *
 * @returns The property management screen.
 */
export const PropertiesPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const propertiesQuery = useQuery({
        queryFn: listProperties,
        queryKey: propertyKeys.list(),
    });
    const ingestMutation = useMutation({
        mutationFn: ({ propertyId }: { propertyId: string }) => ingestProperty(propertyId),
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
        },
    });

    return (
        <div className={"split-layout"}>
            <div className={"page-stack"}>
                <PageCard
                    action={<Link className={"button"} to={"/properties/new"}>{"Add property"}</Link>}
                    description={"Track individual listing pages by URL. Configure CSS-selector rules to extract price, title, and other fields on each scheduled run."}
                    title={"Tracked Properties"}
                >
                    {propertiesQuery.isLoading ? <p className={"muted-copy"}>{"Loading properties..."}</p> : null}
                    {propertiesQuery.isError ? <p className={"error-banner"}>{"Could not load properties."}</p> : null}
                    {propertiesQuery.isSuccess && propertiesQuery.data.length === 0 ? 
                        <EmptyState message={"No properties are being tracked yet."} />
                        : null}
                    {propertiesQuery.data !== undefined && propertiesQuery.data.length > 0 ? (
                        <div className={"item-list"}>
                            {propertiesQuery.data.map((item) => {
                                const displayTitle = item.label !== "" ? item.label : item.url;
                                return (
                                    <article className={"list-row"} key={item.id}>
                                        <div className={"list-row__main"}>
                                            <div>
                                                <h3 className={"list-row__title"}>
                                                    <Link to={`/properties/${item.id}`}>{displayTitle}</Link>
                                                </h3>
                                                <p className={"list-row__meta"}>{item.url}</p>
                                            </div>
                                            <div>
                                                <StatusBadge tone={statusTone(item.status)} value={item.status} />
                                                <strong className={"list-row__price"}>
                                                    {item.next_run_at === undefined
                                                        ? "No schedule"
                                                        : `Next ${formatDateTime(item.next_run_at)}`}
                                                </strong>
                                            </div>
                                        </div>
                                        <div className={"list-row__footer"}>
                                            <span>
                                                {"Last run "}
                                                {item.last_run_at === undefined ? "—" : formatDateTime(item.last_run_at)}
                                            </span>
                                            <div className={"action-group"}>
                                                <Link
                                                    className={"button button--secondary"}
                                                    to={`/properties/${item.id}`}
                                                >
                                                    {"Configure"}
                                                </Link>
                                                <button
                                                    className={"button button--secondary"}
                                                    disabled={ingestMutation.isPending}
                                                    onClick={() => {
                                                        ingestMutation.mutate({ propertyId: item.id });
                                                    }}
                                                    type={"button"}
                                                >
                                                    {"Ingest now"}
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    ) : null}
                </PageCard>
            </div>

            <LiveEventsPanel />
        </div>
    );
};
