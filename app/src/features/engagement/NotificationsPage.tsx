/**
 * File: app/src/features/engagement/NotificationsPage.tsx
 *
 * Purpose:
 * Implements the engagement feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, @tanstack/react-query, react-router-dom, @/components/ui/AsyncContent, @/components/ui/Button, @/components/ui/Field, @/components/ui/FormGrid, @/components/ui/Input; additional imports omitted for brevity
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @tanstack/react-query
 * - react-router-dom
 * - @/components/ui/AsyncContent
 * - @/components/ui/Button
 * - @/components/ui/Field
 * - @/components/ui/FormGrid
 * - @/components/ui/Input
 * - @/components/ui/ItemList
 * - @/components/ui/ListRow
 *
 * Key Decisions:
 * - Keeps documentation adjacent to the implementation so future changes update behavior and context together.
 * - Uses explicit imports and typed boundaries to make ownership traceable from this file in isolation.
 *
 * Constraints:
 * - Documentation must remain synchronized with behavior, tests, and related docs when this file changes.
 * - Runtime behavior must not depend on comments or documentation-only metadata.
 *
 * Related:
 * - /docs/frontend/documentation-template.md
 * - /app/docs/features/engagement.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
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
import { SecondarySurfaceHeader } from "@/components/ui/SecondarySurfaceHeader";
import { formatDateTime } from "@/lib/format/date";
import { readBooleanParam, readNumberParam, writeParam } from "@/lib/routing/searchParams";
import { notificationKeys } from "@/services/notifications/notifications.keys";
import { listNotifications, markNotificationRead, markNotificationUnread } from "@/services/notifications/notifications.service";
import type { NotificationFilters } from "@/services/notifications/notifications.types";

/**
 * Purpose: Renders the NotificationsPage UI boundary documented for app/src/features/engagement/NotificationsPage.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
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

    const notifications = notificationsQuery.data?.items ?? [];
    const unreadCount = notifications.filter((item) => item.read_at === undefined).length;
    const linkedPropertyCount = notifications.filter((item) => item.property_id !== undefined).length;

    return (
        <PageStack>
            <SecondarySurfaceHeader
                description={"Notifications are generated after property runs satisfy alert conditions."}
                summaryAriaLabel={"Notifications overview"}
                summaryItems={[
                    {
                        context: notificationsQuery.isLoading ? "Loading notification scope." : filters.unread_only ? "Unread-only filter is active." : "Showing read and unread items.",
                        label: "In view",
                        value: notificationsQuery.isLoading ? "—" : `${notifications.length}`,
                    },
                    {
                        context: notificationsQuery.isLoading ? "Loading unread status." : unreadCount === 0 ? "No unread notifications in scope." : "Unread items are ready for review.",
                        label: "Unread",
                        value: notificationsQuery.isLoading ? "—" : `${unreadCount}`,
                    },
                    {
                        context: notificationsQuery.isLoading ? "Loading property links." : `Limit set to ${filters.limit}.`,
                        label: "Property links",
                        value: notificationsQuery.isLoading ? "—" : `${linkedPropertyCount}`,
                    },
                ]}
                title={"Notifications"}
            >
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
            </SecondarySurfaceHeader>

            <PageCard description={"Use the property link to jump directly back into the tracked record that triggered the alert."} title={"Notification list"}>
                <AsyncContent
                    emptyMessage={"No notifications matched the current filters."}
                    errorMessage={"Could not load notifications."}
                    isEmpty={notificationsQuery.isSuccess && notifications.length === 0}
                    isError={notificationsQuery.isError}
                    isLoading={notificationsQuery.isLoading}
                    loadingMessage={"Loading notifications..."}
                >
                    <ItemList>
                        {notifications.map((item) => {
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
