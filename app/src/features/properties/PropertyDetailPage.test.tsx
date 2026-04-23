import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { PropertyDetailPage } from "@/features/properties/PropertyDetailPage";
import type {
    Property,
    PropertyExtractionConfig,
    PropertyRun,
    PropertySnapshot,
} from "@/services/properties/properties.types";

const createPropertyMock = vi.fn();
const deletePropertyMock = vi.fn();
const getPropertyMock = vi.fn<(propertyId: string) => Promise<Property>>();
const getPropertyConfigMock = vi.fn<() => Promise<PropertyExtractionConfig>>();
const ingestPropertyMock = vi.fn();
const listAlertRulesMock = vi.fn();
const listBookmarksMock = vi.fn();
const listPropertyRunsMock = vi.fn<() => Promise<PropertyRun[]>>();
const listPropertySnapshotsMock = vi.fn<() => Promise<PropertySnapshot[]>>();
const listPropertyTagsMock = vi.fn();
const listSourcesMock = vi.fn();
const previewExtractionMock = vi.fn();
const setPropertyTagsMock = vi.fn();
const updatePropertyMock = vi.fn<(propertyId: string, payload: Record<string, unknown>) => Promise<Property>>();
const upsertPropertyConfigMock = vi.fn();

vi.mock("@/features/engagement/PropertyAlertCreateDialog", () => {
    const mockedModule: Record<string, unknown> = {};
    mockedModule["PropertyAlertCreateDialog"] = () => null;
    return mockedModule;
});

vi.mock("@/components/selectors/SelectorBuilder", () => {
    const mockedModule: Record<string, unknown> = {};
    mockedModule["SelectorBuilder"] = () => <div>{"Selector builder"}</div>;
    return mockedModule;
});

vi.mock("@/components/tags/TagPicker", () => {
    const mockedModule: Record<string, unknown> = {};
    mockedModule["TagPicker"] = () => null;
    return mockedModule;
});

vi.mock("@/services/alert-rules/alert-rules.constants", () => ({
    getRuleTypeLabel: () => "Alert",
    getRuleTypeLogic: () => "Logic",
}));

vi.mock("@/services/alert-rules/alert-rules.service", () => ({
    listAlertRules: () => listAlertRulesMock(),
}));

vi.mock("@/services/bookmarks/bookmarks.service", () => ({
    createBookmark: vi.fn(),
    deleteBookmark: vi.fn(),
    listBookmarks: () => listBookmarksMock(),
}));

vi.mock("@/services/backoffice-sources/sources.service", () => ({
    listSources: () => listSourcesMock(),
}));

vi.mock("@/services/properties/properties.service", () => ({
    createProperty: (payload: Record<string, unknown>) => createPropertyMock(payload),
    deleteProperty: (propertyId: string) => deletePropertyMock(propertyId),
    getProperty: (propertyId: string) => getPropertyMock(propertyId),
    getPropertyConfig: () => getPropertyConfigMock(),
    ingestProperty: (propertyId: string) => ingestPropertyMock(propertyId),
    listPropertyRuns: () => listPropertyRunsMock(),
    listPropertySnapshots: () => listPropertySnapshotsMock(),
    previewExtraction: (payload: Record<string, unknown>) => previewExtractionMock(payload),
    updateProperty: (propertyId: string, payload: Record<string, unknown>) => updatePropertyMock(propertyId, payload),
    upsertPropertyConfig: (propertyId: string, fields: unknown[]) => upsertPropertyConfigMock(propertyId, fields),
}));

vi.mock("@/services/tags/tags.service", () => ({
    listPropertyTags: () => listPropertyTagsMock(),
    setPropertyTags: (propertyId: string, tagIds: string[]) => setPropertyTagsMock(propertyId, tagIds),
}));

const PROPERTY: Property = {
    id: "prop_1",
    label: "Sunny flat",
    last_run_at: "2024-01-01T11:55:00.000Z",
    next_run_at: "2024-01-01T12:05:00.000Z",
    retry_backoff_millis: 500,
    retry_max_attempts: 3,
    schedule_interval_seconds: 300,
    status: "active",
    url: "https://example.com/listing",
};

const CONFIG: PropertyExtractionConfig = {
    created_at: "2024-01-01T12:00:00.000Z",
    fields: [],
    id: "config_1",
    property_id: "prop_1",
    version: 1,
};

const RUNS: PropertyRun[] = [
    {
        attempt_count: 1,
        created_at: "2024-01-01T11:55:00.000Z",
        id: "prun_1",
        max_attempts: 3,
        property_id: "prop_1",
        status: "success",
        trigger_kind: "scheduled",
    },
];

const renderPropertyDetailPage = (): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
    const router = createMemoryRouter(
        [{ path: "/properties/:propertyId", element: <PropertyDetailPage /> }],
        { initialEntries: ["/properties/prop_1"] },
    );

    return render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <RouterProvider router={router} />
            </ToastProvider>
        </QueryClientProvider>,
    );
};

describe("PropertyDetailPage", () => {
    beforeEach(() => {
        createPropertyMock.mockReset();
        deletePropertyMock.mockReset();
        getPropertyMock.mockReset();
        getPropertyConfigMock.mockReset();
        ingestPropertyMock.mockReset();
        listAlertRulesMock.mockReset();
        listBookmarksMock.mockReset();
        listPropertyRunsMock.mockReset();
        listPropertySnapshotsMock.mockReset();
        listPropertyTagsMock.mockReset();
        listSourcesMock.mockReset();
        previewExtractionMock.mockReset();
        setPropertyTagsMock.mockReset();
        updatePropertyMock.mockReset();
        upsertPropertyConfigMock.mockReset();

        getPropertyMock.mockResolvedValue(PROPERTY);
        getPropertyConfigMock.mockResolvedValue(CONFIG);
        listAlertRulesMock.mockResolvedValue([]);
        listBookmarksMock.mockResolvedValue([]);
        listPropertyRunsMock.mockResolvedValue(RUNS);
        listPropertySnapshotsMock.mockResolvedValue([]);
        listPropertyTagsMock.mockResolvedValue([]);
        listSourcesMock.mockResolvedValue([]);
        updatePropertyMock.mockResolvedValue(PROPERTY);
    });

    it("shows explicit backend-driven scheduling details", async () => {
        renderPropertyDetailPage();

        expect(await screen.findByText("Scheduled")).toBeInTheDocument();
        expect(screen.getAllByText("5 minutes").length).toBeGreaterThan(0);
        expect(screen.getByText("Jan 1, 2024, 12:05 PM")).toBeInTheDocument();
        expect(screen.getByText("Jan 1, 2024, 11:55 AM")).toBeInTheDocument();
    });

    it("saves structured duration controls as schedule seconds", async () => {
        renderPropertyDetailPage();

        fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

        const scheduleInput = document.querySelector<HTMLInputElement>("#prop-schedule-value");
        const scheduleUnit = document.querySelector<HTMLSelectElement>("#prop-schedule-unit");
        expect(scheduleInput).not.toBeNull();
        expect(scheduleUnit).not.toBeNull();

        fireEvent.change(scheduleInput as HTMLInputElement, { target: { value: "1" } });
        fireEvent.change(scheduleUnit as HTMLSelectElement, { target: { value: "hours" } });

        fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

        await waitFor(() => {
            expect(updatePropertyMock).toHaveBeenCalledWith("prop_1", expect.objectContaining({
                schedule_interval_seconds: 3600,
            }));
        });
    });
});
