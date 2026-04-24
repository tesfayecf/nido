import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageCard } from "@/components/ui/PageCard";
import { Preformatted } from "@/components/ui/Preformatted";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toolbar } from "@/components/ui/Toolbar";
import { connectBackofficeEvents } from "@/services/backoffice-events/events.service";
import type { BackofficeEvent } from "@/services/backoffice-events/events.types";
import { formatDateTime } from "@/lib/format/date";
import { useLiveEventsStore } from "@/stores/live-events.store";
import { useSessionStore } from "@/stores/session.store";
import { eventSeverity, eventTone, readEntityId, summarizeEventData } from "@/features/operators/operatorWorkflows";

export const EventsPage = (): JSX.Element => {
    const token = useSessionStore((state) => state.token);
    const addEvent = useLiveEventsStore((state) => state.addEvent);
    const clearEvents = useLiveEventsStore((state) => state.clearEvents);
    const connectionState = useLiveEventsStore((state) => state.connectionState);
    const items = useLiveEventsStore((state) => state.items);
    const removeEvent = useLiveEventsStore((state) => state.removeEvent);
    const setConnectionState = useLiveEventsStore((state) => state.setConnectionState);
    const [selectedEvent, setSelectedEvent] = useState<BackofficeEvent | null>(null);
    const [eventTypeFilter, setEventTypeFilter] = useState("");
    const [propertyIdFilter, setPropertyIdFilter] = useState("");
    const [sourceIdFilter, setSourceIdFilter] = useState("");
    const [severityFilter, setSeverityFilter] = useState("");
    const [pinnedEventIds, setPinnedEventIds] = useState<string[]>([]);

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

    const eventTypeOptions = useMemo(() => {
        return Array.from(new Set(items.map((item) => item.type))).sort((left, right) => left.localeCompare(right));
    }, [items]);

    const filteredItems = useMemo(() => {
        const normalizedEventType = eventTypeFilter.trim().toLowerCase();
        const normalizedPropertyId = propertyIdFilter.trim().toLowerCase();
        const normalizedSourceId = sourceIdFilter.trim().toLowerCase();

        return items.filter((item) => {
            const propertyId = readEntityId(item.data, "property_id").toLowerCase();
            const sourceId = readEntityId(item.data, "source_id").toLowerCase();
            const severity = eventSeverity(item.type);

            if (normalizedEventType !== "" && !item.type.toLowerCase().includes(normalizedEventType)) {
                return false;
            }

            if (normalizedPropertyId !== "" && !propertyId.includes(normalizedPropertyId)) {
                return false;
            }

            if (normalizedSourceId !== "" && !sourceId.includes(normalizedSourceId)) {
                return false;
            }

            if (severityFilter !== "" && severity !== severityFilter) {
                return false;
            }

            return true;
        }).sort((left, right) => {
            const leftPinned = pinnedEventIds.includes(left.id);
            const rightPinned = pinnedEventIds.includes(right.id);
            if (leftPinned !== rightPinned) {
                return leftPinned ? -1 : 1;
            }

            return right.received_at.localeCompare(left.received_at);
        });
    }, [eventTypeFilter, items, pinnedEventIds, propertyIdFilter, severityFilter, sourceIdFilter]);

    const eventRows = useMemo(() => filteredItems.map((item) => ({
        id: `${item.id}-${item.received_at}`,
        item,
    })), [filteredItems]);

    const severityCounts = useMemo(() => {
        return filteredItems.reduce<Record<string, number>>((counts, item) => {
            const severity = eventSeverity(item.type);
            counts[severity] = (counts[severity] ?? 0) + 1;
            return counts;
        }, {});
    }, [filteredItems]);

    return (
        <>
            <PageCard
                action={<Button onClick={clearEvents} variant={"secondary"}>{"Clear all"}</Button>}
                description={"This page shows live in-session activity only. Use the filters to isolate event types, related properties, and sources while you triage active work."}
                title={"Events"}
            >
                <Toolbar stacked>
                    <div className={"toolbar"}>
                        <div className={"entity-page__summary-copy"}>
                            <span className={"muted-copy"}>{`${items.length} events in the current session`}</span>
                        </div>
                        <StatusBadge tone={connectionTone(connectionState)} value={connectionState} />
                    </div>
                    <div className={"toolbar"}>
                        <StatusBadge tone={"danger"} value={`critical ${severityCounts.critical ?? 0}`} />
                        <StatusBadge tone={"warning"} value={`high ${severityCounts.high ?? 0}`} />
                        <StatusBadge tone={"warning"} value={`medium ${severityCounts.medium ?? 0}`} />
                        <StatusBadge tone={"neutral"} value={`low ${severityCounts.low ?? 0}`} />
                    </div>
                </Toolbar>
            </PageCard>

            <PageCard description={"Filter by event type first, then narrow further when property_id or source_id is available in the event payload."} title={"Live event feed"}>
                <div style={{ display: "grid", gap: "1rem" }}>
                    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))" }}>
                        <Field label={"Event type"}>
                            <Select onChange={(event) => { setEventTypeFilter(event.target.value); }} value={eventTypeFilter}>
                                <option value={""}>{"All event types"}</option>
                                {eventTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                            </Select>
                        </Field>
                        <Field label={"Severity"}>
                            <Select onChange={(event) => { setSeverityFilter(event.target.value); }} value={severityFilter}>
                                <option value={""}>{"All severities"}</option>
                                <option value={"critical"}>{"Critical"}</option>
                                <option value={"high"}>{"High"}</option>
                                <option value={"medium"}>{"Medium"}</option>
                                <option value={"low"}>{"Low"}</option>
                            </Select>
                        </Field>
                        <Field label={"Property id"}>
                            <Input onChange={(event) => { setPropertyIdFilter(event.target.value); }} placeholder={"Filter by property"} value={propertyIdFilter} />
                        </Field>
                        <Field label={"Source id"}>
                            <Input onChange={(event) => { setSourceIdFilter(event.target.value); }} placeholder={"Filter by source"} value={sourceIdFilter} />
                        </Field>
                    </div>

                    {filteredItems.length === 0 ? <EmptyState message={"No live events matched the current filters."} /> : (
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
                                    cell: ({ item }) => <StatusBadge tone={eventTone(item.type)} value={eventSeverity(item.type)} />,
                                    header: "Severity",
                                    id: "severity",
                                    sortValue: ({ item }) => eventSeverity(item.type),
                                    width: "8rem",
                                },
                                {
                                    cell: ({ item }) => readEntityId(item.data, "property_id") || "—",
                                    header: "Property",
                                    id: "property_id",
                                    sortValue: ({ item }) => readEntityId(item.data, "property_id"),
                                    width: "10rem",
                                },
                                {
                                    cell: ({ item }) => readEntityId(item.data, "source_id") || "—",
                                    header: "Source",
                                    id: "source_id",
                                    sortValue: ({ item }) => readEntityId(item.data, "source_id"),
                                    width: "10rem",
                                },
                                {
                                    cell: ({ item }) => formatDateTime(item.received_at),
                                    header: "Received",
                                    id: "received_at",
                                    sortValue: ({ item }) => item.received_at,
                                    width: "11rem",
                                },
                                {
                                    cell: ({ item }) => summarizeEventData(item.data),
                                    header: "Summary",
                                    id: "summary",
                                    wrap: true,
                                },
                                {
                                    cell: ({ item }) => (
                                        <div className={"action-group"} onClick={(event) => { event.stopPropagation(); }}>
                                            <Button onClick={() => { setSelectedEvent(item); }} size={"small"} variant={"secondary"}>{"View"}</Button>
                                            <Button
                                                onClick={() => {
                                                    setPinnedEventIds((current) => {
                                                        return current.includes(item.id) ? current.filter((eventId) => eventId !== item.id) : [item.id, ...current];
                                                    });
                                                }}
                                                size={"small"}
                                                variant={"secondary"}
                                            >
                                                {pinnedEventIds.includes(item.id) ? "Unpin" : "Pin"}
                                            </Button>
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
                                    width: "14rem",
                                },
                            ]}
                            compact
                            emptyMessage={"No live events matched the current filters."}
                            getRowId={(row) => row.id}
                            items={eventRows}
                            onRowClick={(row) => { setSelectedEvent(row.item); }}
                            pageSize={12}
                            rowLabel={(row) => `Open event ${row.item.type}`}
                        />
                    )}
                </div>
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
