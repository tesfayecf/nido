import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageCard } from "@/components/ui/PageCard";
import { Preformatted } from "@/components/ui/Preformatted";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { connectBackofficeEvents } from "@/services/backoffice-events/events.service";
import type { BackofficeEvent } from "@/services/backoffice-events/events.types";
import { formatDateTime } from "@/lib/format/date";
import { useLiveEventsStore } from "@/stores/live-events.store";
import { useSessionStore } from "@/stores/session.store";

export const EventsPage = (): JSX.Element => {
    const token = useSessionStore((state) => state.token);
    const addEvent = useLiveEventsStore((state) => state.addEvent);
    const clearEvents = useLiveEventsStore((state) => state.clearEvents);
    const connectionState = useLiveEventsStore((state) => state.connectionState);
    const items = useLiveEventsStore((state) => state.items);
    const removeEvent = useLiveEventsStore((state) => state.removeEvent);
    const setConnectionState = useLiveEventsStore((state) => state.setConnectionState);
    const [selectedEvent, setSelectedEvent] = useState<BackofficeEvent | null>(null);

    useEffect(() => {
        if (token === null) {
            setConnectionState("closed");
            return undefined;
        }

        const controller = new AbortController();

        const connect = async (): Promise<void> => {
            try {
                await connectBackofficeEvents({
                    onConnectionStateChange: setConnectionState,
                    onEvent: addEvent,
                    signal: controller.signal,
                });
            } catch {
                if (!controller.signal.aborted) {
                    setConnectionState("error");
                }
            }
        };

        void connect();

        return () => {
            controller.abort();
            setConnectionState("closed");
        };
    }, [addEvent, setConnectionState, token]);

    const eventRows = useMemo(() => items.map((item) => ({
        id: `${item.id}-${item.received_at}`,
        item,
    })), [items]);

    return (
        <>
            <PageCard
                action={<Button onClick={clearEvents} variant={"secondary"}>{"Clear all"}</Button>}
                description={"Live backoffice events are collected in-session for quick triage and review."}
                title={"Events"}
            >
                <div className={"toolbar"}>
                    <div className={"entity-page__summary-copy"}>
                        <span className={"muted-copy"}>{`${items.length} events in the current session`}</span>
                    </div>
                    <StatusBadge tone={connectionTone(connectionState)} value={connectionState} />
                </div>
            </PageCard>

            <PageCard description={"Rows open the full event payload. Deletion removes the event from the current session view."} title={"Live Event Feed"}>
                {items.length === 0 ? <EmptyState message={"No live events have been received in this session yet."} /> : (
                    <DataTable
                        caption={"Live backoffice events"}
                        columns={[
                            {
                                cell: ({ item }) => item.type,
                                header: "Event",
                                id: "type",
                                sortValue: ({ item }) => item.type,
                            },
                            {
                                cell: ({ item }) => formatDateTime(item.received_at),
                                header: "Received",
                                id: "received_at",
                                sortValue: ({ item }) => item.received_at,
                            },
                            {
                                cell: ({ item }) => summarizeEventData(item.data),
                                header: "Summary",
                                id: "summary",
                            },
                            {
                                cell: ({ item }) => (
                                    <div className={"action-group"} onClick={(event) => { event.stopPropagation(); }}>
                                        <Button onClick={() => { setSelectedEvent(item); }} size={"small"} variant={"secondary"}>{"View"}</Button>
                                        <Button
                                            onClick={() => { removeEvent(item.id, item.received_at); }}
                                            size={"small"}
                                            variant={"secondary"}
                                        >
                                            {"Delete"}
                                        </Button>
                                    </div>
                                ),
                                header: "Actions",
                                id: "actions",
                            },
                        ]}
                        compact
                        emptyMessage={"No live events have been received in this session yet."}
                        getRowId={(row) => row.id}
                        items={eventRows}
                        onRowClick={(row) => { setSelectedEvent(row.item); }}
                        pageSize={12}
                        rowLabel={(row) => `Open event ${row.item.type}`}
                    />
                )}
            </PageCard>

            <Dialog
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedEvent(null);
                    }
                }}
                open={selectedEvent !== null}
                title={selectedEvent?.type ?? "Event"}
            >
                {selectedEvent !== null ? <Preformatted>{JSON.stringify(selectedEvent.data, null, 2)}</Preformatted> : null}
            </Dialog>
        </>
    );
};

const summarizeEventData = (payload: Record<string, unknown>): string => {
    const entries = Object.entries(payload).slice(0, 3);
    if (entries.length === 0) {
        return "No payload fields";
    }

    return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
};

const connectionTone = (state: "closed" | "connecting" | "error" | "open"): "danger" | "neutral" | "success" | "warning" => {
    switch (state) {
        case "open":
            return "success";
        case "connecting":
            return "warning";
        case "error":
            return "danger";
        case "closed":
        default:
            return "neutral";
    }
};
