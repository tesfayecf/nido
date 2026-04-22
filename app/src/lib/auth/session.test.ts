import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import { clearAuthenticatedState, hasActiveSession } from "@/lib/auth/session";
import { authKeys } from "@/services/auth/auth.keys";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { propertyKeys } from "@/services/properties/properties.keys";
import { useLiveEventsStore } from "@/stores/live-events.store";
import { useSessionStore } from "@/stores/session.store";
import { useShellStore } from "@/stores/shell.store";

describe("session helpers", () => {
    beforeEach(() => {
        clearAuthenticatedState();
    });

    it("identifies active sessions using expiry and token state", () => {
        expect(hasActiveSession({ expiresAt: "2026-04-21T12:00:00Z", token: "token-123" }, Date.parse("2026-04-21T11:00:00Z"))).toBe(true);
        expect(hasActiveSession({ expiresAt: "2026-04-21T12:00:00Z", token: "token-123" }, Date.parse("2026-04-21T13:00:00Z"))).toBe(false);
        expect(hasActiveSession({ expiresAt: null, token: "token-123" })).toBe(false);
    });

    it("clears protected client and query state together", () => {
        const queryClient = new QueryClient();
        queryClient.setQueryData(authKeys.me(), { id: "user-1" });
        queryClient.setQueryData(bookmarkKeys.all(), [{ id: "bookmark-1" }]);
        queryClient.setQueryData(runKeys.list({ limit: 20 }), [{ id: "run-1" }]);
        queryClient.setQueryData(propertyKeys.list(), [{ id: "property-1" }]);

        useSessionStore.getState().setSession({
            expiresAt: "2026-04-21T12:00:00Z",
            token: "token-123",
        });
        useLiveEventsStore.getState().setConnectionState("open");
        useLiveEventsStore.getState().addEvent({
            data: { status: "ok" },
            id: "event-1",
            received_at: "2026-04-21T10:00:00Z",
            type: "ingestion.run.completed",
        });
        useShellStore.getState().setNavOpen(false);

        clearAuthenticatedState(queryClient);

        expect(useSessionStore.getState().token).toBeNull();
        expect(useLiveEventsStore.getState().items).toEqual([]);
        expect(useLiveEventsStore.getState().connectionState).toBe("closed");
        expect(useShellStore.getState().navOpen).toBe(true);
        expect(queryClient.getQueryData(authKeys.me())).toBeUndefined();
        expect(queryClient.getQueryData(bookmarkKeys.all())).toBeUndefined();
        expect(queryClient.getQueryData(runKeys.list({ limit: 20 }))).toBeUndefined();
        expect(queryClient.getQueryData(propertyKeys.list())).toEqual([{ id: "property-1" }]);
    });
});
