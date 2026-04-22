import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageCard } from "@/components/ui/PageCard";
import { ItemList } from "@/components/ui/ItemList";
import { ListRow, ListRowMain } from "@/components/ui/ListRow";
import { Preformatted } from "@/components/ui/Preformatted";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toolbar } from "@/components/ui/Toolbar";
import { formatDateTime } from "@/lib/format/date";
import { connectBackofficeEvents } from "@/services/backoffice-events/events.service";
import { useLiveEventsStore } from "@/stores/live-events.store";
import { useSessionStore } from "@/stores/session.store";

/**
 * Renders the authenticated backoffice SSE stream.
 *
 * The panel connects only while mounted to avoid holding unnecessary browser
 * SSE connections open across unrelated routes.
 *
 * @returns A live event feed for ingestion progress and notification activity.
 */
export const LiveEventsPanel = (): JSX.Element => {
    const token = useSessionStore((state) => state.token);
    const clearEvents = useLiveEventsStore((state) => state.clearEvents);
    const connectionState = useLiveEventsStore((state) => state.connectionState);
    const items = useLiveEventsStore((state) => state.items);
    const addEvent = useLiveEventsStore((state) => state.addEvent);
    const setConnectionState = useLiveEventsStore((state) => state.setConnectionState);

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

    return (
        <PageCard
            action={<Button onClick={clearEvents} variant={"secondary"}>{"Clear"}</Button>}
            description={"The SSE stream mirrors the backend backoffice event feed and is scoped to authenticated operator routes."}
            title={"Live Events"}
        >
            <Toolbar>
                <span className={"muted-copy"}>{"Connection"}</span>
                <StatusBadge tone={connectionTone(connectionState)} value={connectionState} />
            </Toolbar>

            {items.length === 0 ? <EmptyState message={"No live events have been received in this session yet."} /> : null}
            {items.length > 0 ? (
                <ItemList>
                    {items.map((item) => {
                        return (
                            <ListRow key={`${item.id}-${item.received_at}`}>
                                <ListRowMain>
                                    <div>
                                        <h3 className={"list-row__title"}>{item.type}</h3>
                                        <p className={"list-row__meta"}>{"Received "}{formatDateTime(item.received_at)}</p>
                                    </div>
                                </ListRowMain>
                                <Preformatted compact>{JSON.stringify(item.data, null, 2)}</Preformatted>
                            </ListRow>
                        );
                    })}
                </ItemList>
            ) : null}
        </PageCard>
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
