import { describe, expect, it } from "vitest";

import type { Run } from "@/services/backoffice-runs/runs.types";
import type { Notification } from "@/services/notifications/notifications.types";
import type { Property } from "@/services/properties/properties.types";
import { applySavedView, buildDashboardSummary, buildPropertyRunSummary, buildTriageItems, eventSeverity, mergeBulkTagIds, retainVisibleSelection, summarizeEventData } from "@/features/operators/operatorWorkflows";

const properties: Property[] = [
    {
        id: "property-1",
        label: "Healthy property",
        last_run_at: "2026-04-24T05:00:00.000Z",
        next_run_at: "2026-04-24T08:00:00.000Z",
        retry_backoff_millis: 500,
        retry_max_attempts: 3,
        schedule_interval_seconds: 3600,
        source_id: "source-1",
        status: "active",
        updated_at: "2026-04-24T05:30:00.000Z",
        url: "https://example.com/healthy",
    },
    {
        id: "property-2",
        label: "Needs help",
        retry_backoff_millis: 500,
        retry_max_attempts: 3,
        schedule_interval_seconds: 3600,
        source_id: "source-2",
        status: "degraded",
        updated_at: "2026-04-24T06:00:00.000Z",
        url: "https://example.com/problem",
    },
];

const runs: Run[] = [
    {
        config_version: 1,
        error_message: "selector failed",
        id: "run-1",
        is_valid: false,
        observed_at: "2026-04-24T05:45:00.000Z",
        property_id: "property-2",
        values: {},
    },
    {
        config_version: 1,
        id: "run-2",
        is_valid: true,
        observed_at: "2026-04-24T04:45:00.000Z",
        property_id: "property-1",
        values: { price: "200000" },
    },
];

const notifications: Notification[] = [
    {
        body: "Price changed",
        created_at: "2026-04-24T05:50:00.000Z",
        delivery_status: "delivered",
        id: "notification-1",
        kind: "price_change",
        property_id: "property-2",
        title: "Price alert",
    },
];

describe("operatorWorkflows", () => {
    it("builds latest run state per property", () => {
        const summary = buildPropertyRunSummary(runs);

        expect(summary.get("property-2")?.latestRun?.id).toBe("run-1");
        expect(summary.get("property-2")?.failedCount).toBe(1);
        expect(summary.get("property-1")?.hasSuccessfulRun).toBe(true);
    });

    it("filters saved views for urgent queues", () => {
        const filtered = applySavedView(properties, {
            bookmarkedIds: new Set<string>(),
            propertyTagNamesById: new Map([["property-2", ["high priority"]]]),
            runSummaryByPropertyId: buildPropertyRunSummary(runs),
            viewId: "failing-now",
        });

        expect(filtered.map((property) => property.id)).toEqual(["property-2"]);
    });

    it("builds dashboard and triage summaries from shared data", () => {
        const runSummary = buildPropertyRunSummary(runs);
        const dashboard = buildDashboardSummary({
            notifications,
            now: new Date("2026-04-24T06:00:00.000Z"),
            properties,
            runs,
            sources: [
                { id: "source-1", name: "Source One" },
                { id: "source-2", name: "Source Two" },
            ],
        });
        const triageItems = buildTriageItems({
            notifications,
            properties,
            runSummaryByPropertyId: runSummary,
            runs,
        });

        expect(dashboard.failedRunsLast24Hours).toBe(1);
        expect(dashboard.unreadNotifications).toBe(1);
        expect(dashboard.topProblemSources[0]?.sourceId).toBe("source-2");
        expect(triageItems[0]?.kind).toBe("run");
    });

    it("merges bulk tags without duplicating existing tags", () => {
        expect(mergeBulkTagIds(["alpha", "beta"], ["beta", "gamma"])).toEqual(["alpha", "beta", "gamma"]);
    });

    it("clears selected rows that disappear from the filtered set", () => {
        expect(retainVisibleSelection(["property-1", "property-2"], ["property-2"])).toEqual(["property-2"]);
    });

    it("creates richer live event summaries", () => {
        expect(eventSeverity("ingestion.run.failed")).toBe("critical");
        expect(summarizeEventData({ error: "failed", property_id: "property-2", source_id: "source-2" })).toContain("property_id: property-2");
    });
});
