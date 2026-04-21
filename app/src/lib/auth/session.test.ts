import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import { clearAuthenticatedState, hasActiveSession } from "@/lib/auth/session";
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
        queryClient.setQueryData(["auth", "me"], { id: "user-1" });
        queryClient.setQueryData(["me", "watchlists"], [{ id: "watch-1" }]);
        queryClient.setQueryData(["backoffice", "runs", "list", { limit: 20 }], [{ id: "run-1" }]);
        queryClient.setQueryData(["listings", "list", { q: "" }], [{ id: "listing-1" }]);

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
        useShellStore.getState().setLiveRailOpen(false);
        useShellStore.getState().setNavOpen(false);

        clearAuthenticatedState(queryClient);

        expect(useSessionStore.getState().token).toBeNull();
        expect(useLiveEventsStore.getState().items).toEqual([]);
        expect(useLiveEventsStore.getState().connectionState).toBe("closed");
        expect(useShellStore.getState().liveRailOpen).toBe(true);
        expect(useShellStore.getState().navOpen).toBe(true);
        expect(queryClient.getQueryData(["auth", "me"])).toBeUndefined();
        expect(queryClient.getQueryData(["me", "watchlists"])).toBeUndefined();
        expect(queryClient.getQueryData(["backoffice", "runs", "list", { limit: 20 }])).toBeUndefined();
        expect(queryClient.getQueryData(["listings", "list", { q: "" }])).toEqual([{ id: "listing-1" }]);
    });
});