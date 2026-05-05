/**
 * File: app/src/services/tags/tags.service.test.ts
 *
 * Purpose:
 * Validates the documented behavior of tags.service and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: vitest, @/stores/session.store, @/services/tags/tags.service
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - vitest
 * - @/stores/session.store
 * - @/services/tags/tags.service
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
 * - /docs/frontend/architecture-overview.md#api-contracts
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
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
