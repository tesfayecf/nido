/**
 * Enumerates the currently known backoffice SSE event names.
 */
export type BackofficeEventType =
    | "ingestion.fetch.completed"
    | "ingestion.fetch.started"
    | "ingestion.parse.completed"
    | "ingestion.reconcile.completed"
    | "ingestion.run.completed"
    | "ingestion.run.failed"
    | "ingestion.run.started"
    | "notification.created";

/**
 * Represents one decoded backoffice SSE event.
 */
export interface BackofficeEvent {
    readonly data: Record<string, unknown>;
    readonly id: string;
    readonly received_at: string;
    readonly type: BackofficeEventType | string;
}