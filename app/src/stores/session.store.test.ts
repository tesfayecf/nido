import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session.store";

describe("session store", () => {
    beforeEach(() => {
        useSessionStore.getState().clearSession();
    });

    it("stores and clears the bearer snapshot", () => {
        useSessionStore.getState().setSession({
            expiresAt: "2026-04-21T12:00:00Z",
            token: "token-123",
        });

        expect(useSessionStore.getState().token).toBe("token-123");
        expect(useSessionStore.getState().expiresAt).toBe("2026-04-21T12:00:00Z");

        useSessionStore.getState().clearSession();

        expect(useSessionStore.getState().token).toBeNull();
        expect(useSessionStore.getState().expiresAt).toBeNull();
    });
});