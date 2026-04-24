import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/ToastProvider";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { listSources } from "@/services/backoffice-sources/sources.service";
import { notificationKeys } from "@/services/notifications/notifications.keys";
import { listNotifications } from "@/services/notifications/notifications.service";
import { propertyKeys } from "@/services/properties/properties.keys";
import { ingestProperty, listProperties } from "@/services/properties/properties.service";

interface CommandResult {
    readonly description: string;
    readonly group: string;
    readonly id: string;
    readonly label: string;
    readonly onSelect: () => void;
}

const UNREAD_NOTIFICATION_FILTERS = { limit: 10, unread_only: true };

export const CommandPalette = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");

    const propertiesQuery = useQuery({
        queryFn: () => listProperties(),
        queryKey: propertyKeys.list(),
        staleTime: 60_000,
    });
    const sourcesQuery = useQuery({
        queryFn: listSources,
        queryKey: sourceKeys.list(),
        staleTime: 60_000,
    });
    const notificationsQuery = useQuery({
        queryFn: () => listNotifications(UNREAD_NOTIFICATION_FILTERS),
        queryKey: notificationKeys.list(UNREAD_NOTIFICATION_FILTERS),
        staleTime: 30_000,
    });
    const runNowMutation = useMutation({
        mutationFn: (propertyId: string) => ingestProperty(propertyId),
        onError() {
            pushToast("Could not trigger the run.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: runKeys.all() });
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            pushToast("Run started.", "success");
        },
    });

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setOpen(true);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    useEffect(() => {
        if (!open) {
            setQuery("");
        }
    }, [open]);

    const results = useMemo<CommandResult[]>(() => {
        const baseResults: CommandResult[] = [
            {
                description: "Go back to the portfolio overview.",
                group: "Commands",
                id: "dashboard",
                label: "Open dashboard",
                onSelect: () => { void navigate("/dashboard"); },
            },
            {
                description: "Jump straight into the consolidated work queue.",
                group: "Commands",
                id: "triage",
                label: "Open triage inbox",
                onSelect: () => { void navigate("/triage"); },
            },
            {
                description: "Show the saved view with urgent properties.",
                group: "Commands",
                id: "failing-properties",
                label: "Open failing properties",
                onSelect: () => { void navigate("/properties?view=failing-now"); },
            },
            {
                description: "Review unread alerts and notifications.",
                group: "Commands",
                id: "notifications",
                label: "Open unread notifications",
                onSelect: () => { void navigate("/notifications?unread_only=true"); },
            },
            {
                description: "Create a new tracked property.",
                group: "Commands",
                id: "new-property",
                label: "Add property",
                onSelect: () => { void navigate("/properties/new"); },
            },
        ];
        const propertyResults = (propertiesQuery.data ?? []).flatMap((property) => {
            const label = property.label !== "" ? property.label : property.url;
            return [
                {
                    description: property.url,
                    group: "Properties",
                    id: `property-open-${property.id}`,
                    label: `Open ${label}`,
                    onSelect: () => { void navigate(`/properties/${property.id}`); },
                },
                {
                    description: `Trigger a manual run for ${label}.`,
                    group: "Actions",
                    id: `property-run-${property.id}`,
                    label: `Run ${label} now`,
                    onSelect: () => { runNowMutation.mutate(property.id); },
                },
            ];
        });
        const sourceResults = (sourcesQuery.data ?? []).map((source) => ({
            description: source.id,
            group: "Sources",
            id: `source-${source.id}`,
            label: `Open source ${source.name}`,
            onSelect: () => { void navigate(`/sources/${source.id}`); },
        }));
        const notificationResults = (notificationsQuery.data?.items ?? []).map((notification) => ({
            description: notification.body,
            group: "Notifications",
            id: `notification-${notification.id}`,
            label: notification.title,
            onSelect: () => {
                if (notification.property_id !== undefined) {
                    void navigate(`/properties/${notification.property_id}`);
                    return;
                }

                void navigate("/notifications?unread_only=true");
            },
        }));

        const allResults = [...baseResults, ...propertyResults, ...sourceResults, ...notificationResults];
        if (query.trim() === "") {
            return allResults.slice(0, 12);
        }

        const normalizedQuery = query.trim().toLowerCase();
        return allResults.filter((result) => {
            return `${result.label} ${result.description} ${result.group}`.toLowerCase().includes(normalizedQuery);
        }).slice(0, 20);
    }, [navigate, notificationsQuery.data?.items, propertiesQuery.data, query, runNowMutation, sourcesQuery.data]);

    return (
        <>
            <Button iconBefore={<Icon name={"search"} />} onClick={() => { setOpen(true); }} variant={"secondary"}>
                {"Command palette"}
            </Button>
            <Dialog
                className={"dialog--wide"}
                description={"Search routes, properties, sources, and urgent actions. Use Ctrl+K or Cmd+K to open this from anywhere."}
                onOpenChange={setOpen}
                open={open}
                title={"Search and actions"}
            >
                <div style={{ display: "grid", gap: "1rem" }}>
                    <Input onChange={(event) => { setQuery(event.target.value); }} placeholder={"Search properties, sources, and commands"} type={"search"} value={query} />
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                        {results.length === 0 ? <p className={"muted-copy"}>{"No commands matched your search."}</p> : null}
                        {results.map((result) => (
                            <button
                                key={result.id}
                                onClick={() => {
                                    result.onSelect();
                                    setOpen(false);
                                }}
                                style={{ alignItems: "flex-start", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", cursor: "pointer", display: "grid", gap: "0.25rem", padding: "0.875rem", textAlign: "left" }}
                                type={"button"}
                            >
                                <span className={"muted-copy"} style={{ marginTop: 0 }}>{result.group}</span>
                                <strong>{result.label}</strong>
                                <span className={"muted-copy"} style={{ marginTop: 0 }}>{result.description}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </Dialog>
        </>
    );
};
