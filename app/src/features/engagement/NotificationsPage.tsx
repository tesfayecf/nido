import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { AsyncContent } from "@/components/ui/AsyncContent";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { ItemList } from "@/components/ui/ItemList";
import { ListRow, ListRowFooter, ListRowMain } from "@/components/ui/ListRow";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
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
        <PageStack>
            <PageCard description={"In-app alerts are generated after property runs satisfy your configured alert conditions."} title={"Alerts Inbox"}>
                <FormGrid
                    variant={"inline"}
                    onSubmit={(event) => {
                        event.preventDefault();
                        const nextParams = new URLSearchParams(searchParams);
                        writeParam(nextParams, "unread_only", `${unreadOnly}`);
                        writeParam(nextParams, "limit", limit);
                        setSearchParams(nextParams);
                    }}
                >
                    <Field label={"Unread only"} variant={"checkbox"}>
                        <input checked={unreadOnly} onChange={(event) => { setUnreadOnly(event.target.checked); }} type={"checkbox"} />
                    </Field>
                    <Field label={"Limit"}>
                        <Input min={1} onChange={(event) => { setLimit(event.target.value); }} step={1} type={"number"} value={limit} />
                    </Field>
                    <Field as={"div"} variant={"actions"}>
                        <Button type={"submit"}>{"Apply"}</Button>
                    </Field>
                </FormGrid>
            </PageCard>

            <PageCard description={"Use the property link to jump directly back into the tracked record that triggered the alert."} title={"Recent Alerts"}>
                <AsyncContent
                    emptyMessage={"No notifications matched the current filters."}
                    errorMessage={"Could not load notifications."}
                    isEmpty={notificationsQuery.isSuccess && notificationsQuery.data.items.length === 0}
                    isError={notificationsQuery.isError}
                    isLoading={notificationsQuery.isLoading}
                    loadingMessage={"Loading notifications..."}
                >
                    <ItemList>
                        {(notificationsQuery.data?.items ?? []).map((item) => {
                            return (
                                <ListRow key={item.id}>
                                    <ListRowMain>
                                        <div>
                                            <h3 className={"list-row__title"}>{item.title}</h3>
                                            <p className={"list-row__meta"}>{item.body}</p>
                                        </div>
                                        <strong className={"list-row__price"}>{item.kind}</strong>
                                    </ListRowMain>
                                    <ListRowFooter>
                                        <span>{item.read_at === undefined ? "Unread" : `Read ${formatDateTime(item.read_at)}`}</span>
                                        <span>{"Created "}{formatDateTime(item.created_at)}</span>
                                        {item.property_id !== undefined ? <Link className={"text-link"} to={`/properties/${item.property_id}`}>{"Open property"}</Link> : null}
                                        {item.read_at === undefined ? 
                                            <Button disabled={markReadMutation.isPending} onClick={() => { markReadMutation.mutate(item.id); }} variant={"secondary"}>{"Mark read"}</Button>
                                            : 
                                            <Button disabled={markUnreadMutation.isPending} onClick={() => { markUnreadMutation.mutate(item.id); }} variant={"secondary"}>{"Mark unread"}</Button>
                                        }
                                    </ListRowFooter>
                                </ListRow>
                            );
                        })}
                    </ItemList>
                </AsyncContent>
            </PageCard>
        </PageStack>
    );
};
