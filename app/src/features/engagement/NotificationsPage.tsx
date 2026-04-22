import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { AsyncContent } from "@/components/ui/AsyncContent";
import { PageCard } from "@/components/ui/PageCard";
import { formatDateTime } from "@/lib/format/date";
import { readBooleanParam, readNumberParam, writeParam } from "@/lib/routing/searchParams";
import { notificationKeys } from "@/services/notifications/notifications.keys";
import { listNotifications, markNotificationRead, markNotificationUnread } from "@/services/notifications/notifications.service";
import type { NotificationFilters } from "@/services/notifications/notifications.types";

export const NotificationsPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const filters: NotificationFilters = {
        limit: readNumberParam(searchParams, "limit", 50),
        unread_only: readBooleanParam(searchParams, "unread_only", false),
    };
    const [unreadOnly, setUnreadOnly] = useState(filters.unread_only);
    const [limit, setLimit] = useState(`${filters.limit}`);
    const notificationsQuery = useQuery({
        queryFn: () => listNotifications(filters),
        queryKey: notificationKeys.list(filters),
    });
    const markReadMutation = useMutation({
        mutationFn: markNotificationRead,
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
        },
    });
    const markUnreadMutation = useMutation({
        mutationFn: markNotificationUnread,
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
        },
    });

    useEffect(() => {
        setUnreadOnly(filters.unread_only);
        setLimit(`${filters.limit}`);
    }, [filters.limit, filters.unread_only]);

    return (
        <div className={"page-stack"}>
            <PageCard description={"Notifications are generated after property runs satisfy alert conditions."} title={"Notifications"}>
                <form
                    className={"form-grid form-grid--inline"}
                    onSubmit={(event) => {
                        event.preventDefault();
                        const nextParams = new URLSearchParams(searchParams);
                        writeParam(nextParams, "unread_only", `${unreadOnly}`);
                        writeParam(nextParams, "limit", limit);
                        setSearchParams(nextParams);
                    }}
                >
                    <label className={"field field--checkbox"}>
                        <input checked={unreadOnly} onChange={(event) => { setUnreadOnly(event.target.checked); }} type={"checkbox"} />
                        <span className={"field__label"}>{"Unread only"}</span>
                    </label>
                    <label className={"field"}>
                        <span className={"field__label"}>{"Limit"}</span>
                        <input className={"field__control"} min={1} onChange={(event) => { setLimit(event.target.value); }} step={1} type={"number"} value={limit} />
                    </label>
                    <div className={"field field--actions"}>
                        <button className={"button"} type={"submit"}>{"Apply"}</button>
                    </div>
                </form>
            </PageCard>

            <PageCard description={"Use the property link to jump directly back into the tracked record that triggered the alert."} title={"Inbox"}>
                <AsyncContent
                    emptyMessage={"No notifications matched the current filters."}
                    errorMessage={"Could not load notifications."}
                    isEmpty={notificationsQuery.isSuccess && notificationsQuery.data.items.length === 0}
                    isError={notificationsQuery.isError}
                    isLoading={notificationsQuery.isLoading}
                    loadingMessage={"Loading notifications..."}
                >
                    <div className={"item-list"}>
                        {(notificationsQuery.data?.items ?? []).map((item) => {
                            return (
                                <article className={"list-row"} key={item.id}>
                                    <div className={"list-row__main"}>
                                        <div>
                                            <h3 className={"list-row__title"}>{item.title}</h3>
                                            <p className={"list-row__meta"}>{item.body}</p>
                                        </div>
                                        <strong className={"list-row__price"}>{item.kind}</strong>
                                    </div>
                                    <div className={"list-row__footer"}>
                                        <span>{item.read_at === undefined ? "Unread" : `Read ${formatDateTime(item.read_at)}`}</span>
                                        <span>{"Created "}{formatDateTime(item.created_at)}</span>
                                        {item.property_id !== undefined ? <Link className={"text-link"} to={`/properties/${item.property_id}`}>{"Open property"}</Link> : null}
                                        {item.read_at === undefined ? 
                                            <button className={"button button--secondary"} disabled={markReadMutation.isPending} onClick={() => { markReadMutation.mutate(item.id); }} type={"button"}>{"Mark read"}</button>
                                            : 
                                            <button className={"button button--secondary"} disabled={markUnreadMutation.isPending} onClick={() => { markUnreadMutation.mutate(item.id); }} type={"button"}>{"Mark unread"}</button>
                                        }
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </AsyncContent>
            </PageCard>
        </div>
    );
};
