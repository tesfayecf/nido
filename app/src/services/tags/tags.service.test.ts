import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "@/stores/session.store";
import { createTag, deleteTag, listPropertyTags, listTags, setPropertyTags } from "@/services/tags/tags.service";

describe("tags.service", () => {
    beforeEach(() => {
        // Mock the session store to provide a valid token
        vi.spyOn(useSessionStore, "getState").mockReturnValue({
            clearSession: vi.fn(),
            expiresAt: null,
            setSession: vi.fn(),
            token: "mock-token",
        });
    });

    it("builds correct URL for listTags", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            headers: new Headers({ "Content-Type": "application/json" }),
            json: async () => ({ count: 0, items: [] }),
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () => '{"items":[],"count":0}',
        });

        vi.stubGlobal("fetch", mockFetch);

        await listTags();

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/v1/backoffice/tags"),
            expect.objectContaining({
                method: "GET",
            }),
        );

        vi.unstubAllGlobals();
    });

    it("builds correct URL for createTag", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            headers: new Headers({ "Content-Type": "application/json" }),
            json: async () => ({ item: { color: "#ff0000", created_at: "2025-01-01", id: "tag1", name: "Test", updated_at: "2025-01-01" } }),
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () => '{"item":{}}',
        });

        vi.stubGlobal("fetch", mockFetch);

        await createTag({ color: "#ff0000", name: "Test" });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/v1/backoffice/tags"),
            expect.objectContaining({
                body: JSON.stringify({ color: "#ff0000", name: "Test" }),
                method: "POST",
            }),
        );

        vi.unstubAllGlobals();
    });

    it("builds correct URL for deleteTag", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            headers: new Headers({ "Content-Type": "application/json" }),
            json: async () => ({ status: "ok" }),
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () => '{"status":"ok"}',
        });

        vi.stubGlobal("fetch", mockFetch);

        await deleteTag("tag1");

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/v1/backoffice/tags/tag1"),
            expect.objectContaining({
                method: "DELETE",
            }),
        );

        vi.unstubAllGlobals();
    });

    it("builds correct URL for listPropertyTags", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            headers: new Headers({ "Content-Type": "application/json" }),
            json: async () => ({ count: 0, items: [] }),
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () => '{"items":[],"count":0}',
        });

        vi.stubGlobal("fetch", mockFetch);

        await listPropertyTags("prop1");

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/v1/backoffice/properties/prop1/tags"),
            expect.objectContaining({
                method: "GET",
            }),
        );

        vi.unstubAllGlobals();
    });

    it("builds correct URL for setPropertyTags", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            headers: new Headers({ "Content-Type": "application/json" }),
            json: async () => ({ status: "ok" }),
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () => '{"status":"ok"}',
        });

        vi.stubGlobal("fetch", mockFetch);

        await setPropertyTags("prop1", ["tag1", "tag2"]);

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/v1/backoffice/properties/prop1/tags"),
            expect.objectContaining({
                body: JSON.stringify({ tag_ids: ["tag1", "tag2"] }),
                method: "PUT",
            }),
        );

        vi.unstubAllGlobals();
    });
});
