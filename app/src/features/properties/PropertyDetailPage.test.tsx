import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { PropertyDetailPage } from "@/features/properties/PropertyDetailPage";
import { formatDateTime } from "@/lib/format/date";
import type { FieldDefinitionUsage } from "@/services/fields/fields.types";
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
const getPropertySummaryMock = vi.fn();
const ingestPropertyMock = vi.fn();
const listAlertRulesMock = vi.fn();
const listPropertyConfigVersionsMock = vi.fn<() => Promise<PropertyExtractionConfig[]>>();
const listBookmarksMock = vi.fn();
const listPropertyRunsMock = vi.fn<() => Promise<PropertyRun[]>>();
const listPropertySnapshotsMock = vi.fn<() => Promise<PropertySnapshot[]>>();
const listPropertySummariesMock = vi.fn();
const listFieldsMock = vi.fn<() => Promise<FieldDefinitionUsage[]>>();
const listPropertyTagsMock = vi.fn();
const listSourcesMock = vi.fn();
const previewExtractionMock = vi.fn();
const rollbackPropertyConfigMock = vi.fn();
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
    mockedModule["SelectorBuilder"] = ({ fieldMetadataById, fields, onChange }: {
        readonly fieldMetadataById?: Record<string, { readonly origin: string; readonly status: string; }>;
        readonly fields: { readonly id: string; readonly name: string; }[];
        readonly onChange: (updater: (currentFields: { readonly id: string; readonly name: string; }[]) => { readonly id: string; readonly name: string; }[]) => void;
    }) => (
        <div>
            <div>{"Selector builder"}</div>
            {fields.map((field) => (
                <div key={field.id}>
                    <span>{field.name === "" ? "Untitled field" : field.name}</span>
                    <span>{`${fieldMetadataById?.[field.id]?.origin ?? "manual"}:${fieldMetadataById?.[field.id]?.status ?? "manual"}`}</span>
                    <button
                        onClick={() => {
                            onChange((currentFields) => currentFields.filter((item) => item.id !== field.id));
                        }}
                        type={"button"}
                    >
                        {`Remove ${field.name === "" ? field.id : field.name}`}
                    </button>
                </div>
            ))}
            <button
                onClick={() => {
                    onChange((currentFields) => currentFields.map((field, index) => {
                        if (index !== 0) {
                            return field;
                        }

                        return { ...field, name: `${field.name}_modified` };
                    }));
                }}
                type={"button"}
            >
                {"Modify first field"}
            </button>
        </div>
    );
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

vi.mock("@/services/fields/fields.service", () => ({
    listFields: () => listFieldsMock(),
}));

vi.mock("@/services/properties/properties.service", () => ({
    createProperty: (payload: Record<string, unknown>) => createPropertyMock(payload),
    deleteProperty: (propertyId: string) => deletePropertyMock(propertyId),
    getProperty: (propertyId: string) => getPropertyMock(propertyId),
    getPropertyConfig: () => getPropertyConfigMock(),
    getPropertySummary: (propertyId: string) => getPropertySummaryMock(propertyId),
    ingestProperty: (propertyId: string) => ingestPropertyMock(propertyId),
    listPropertyRuns: () => listPropertyRunsMock(),
    listPropertyConfigVersions: () => listPropertyConfigVersionsMock(),
    listPropertySnapshots: () => listPropertySnapshotsMock(),
    listPropertySummaries: () => listPropertySummariesMock(),
    previewExtraction: (payload: Record<string, unknown>) => previewExtractionMock(payload),
    rollbackPropertyConfig: (propertyId: string, version: number) => rollbackPropertyConfigMock(propertyId, version),
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

const SUMMARY = {
    current_values: { area_m2: "80", location: "Bilbao", price: "220000" },
    decision: {
        current_price: 220000,
        current_price_per_sqm: 2750,
        freshness_status: "fresh" as const,
        stage: "candidate",
        target_price: 210000,
    },
    latest_change_summary: "Price updated",
    property: PROPERTY,
    signals: [],
};

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

const renderPropertyCreatePage = (): ReturnType<typeof render> => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
    const router = createMemoryRouter(
        [
            { path: "/properties", element: <div>{"Properties list"}</div> },
            { path: "/properties/new", element: <PropertyDetailPage /> },
            { path: "/properties/:propertyId", element: <PropertyDetailPage /> },
        ],
        { initialEntries: ["/properties/new"] },
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
        window.localStorage.clear();
        createPropertyMock.mockReset();
        deletePropertyMock.mockReset();
        getPropertyMock.mockReset();
        getPropertyConfigMock.mockReset();
        getPropertySummaryMock.mockReset();
        ingestPropertyMock.mockReset();
        listAlertRulesMock.mockReset();
        listPropertyConfigVersionsMock.mockReset();
        listBookmarksMock.mockReset();
        listPropertyRunsMock.mockReset();
        listPropertySnapshotsMock.mockReset();
        listPropertySummariesMock.mockReset();
        listFieldsMock.mockReset();
        listPropertyTagsMock.mockReset();
        listSourcesMock.mockReset();
        previewExtractionMock.mockReset();
        rollbackPropertyConfigMock.mockReset();
        setPropertyTagsMock.mockReset();
        updatePropertyMock.mockReset();
        upsertPropertyConfigMock.mockReset();

        getPropertyMock.mockResolvedValue(PROPERTY);
        getPropertyConfigMock.mockResolvedValue(CONFIG);
        getPropertySummaryMock.mockResolvedValue(SUMMARY);
        listAlertRulesMock.mockResolvedValue([]);
        listBookmarksMock.mockResolvedValue([]);
        listPropertyConfigVersionsMock.mockResolvedValue([CONFIG]);
        listPropertyRunsMock.mockResolvedValue(RUNS);
        listPropertySnapshotsMock.mockResolvedValue([]);
        listPropertySummariesMock.mockResolvedValue([SUMMARY]);
        listFieldsMock.mockResolvedValue([]);
        listPropertyTagsMock.mockResolvedValue([]);
        listSourcesMock.mockResolvedValue([]);
        updatePropertyMock.mockResolvedValue(PROPERTY);
    });

    it("shows explicit backend-driven scheduling details", async () => {
        renderPropertyDetailPage();

        expect(await screen.findByText("Scheduled")).toBeInTheDocument();
        expect(screen.getByText(formatDateTime(PROPERTY.next_run_at as string))).toBeInTheDocument();
        expect(screen.getByText(formatDateTime(PROPERTY.last_run_at as string))).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Configuration" }));
        expect(screen.getAllByText("5 minutes").length).toBeGreaterThan(0);
    });

    it("switches sections without scrolling and only renders the active panel", async () => {
        renderPropertyDetailPage();

        await screen.findByText("Sunny flat");
        expect(screen.queryByText("Selector builder")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Notes & Decisions" }));

        expect(screen.getByLabelText("Target price")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save notes & decisions" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Configuration" }));

        expect(window.location.hash).toBe("");
        expect(screen.getByText("Selector builder")).toBeInTheDocument();
        expect(screen.queryByLabelText("Target price")).not.toBeInTheDocument();
    });

    it("renders exactly four property sections in the required order", async () => {
        renderPropertyDetailPage();

        await screen.findByText("Sunny flat");
        const navLabels = screen.getAllByRole("button")
            .map((button) => button.textContent)
            .filter((label): label is string => label === "Overview" || label === "Insights" || label === "Notes & Decisions" || label === "Configuration");

        expect(navLabels).toEqual(["Overview", "Insights", "Notes & Decisions", "Configuration"]);
    });

    it("keeps note editing inside notes and decisions while configuration stays operational", async () => {
        renderPropertyDetailPage();

        await screen.findByText("Sunny flat");
        fireEvent.click(screen.getByRole("button", { name: "Notes & Decisions" }));

        expect(screen.getByLabelText("Decision status")).toBeInTheDocument();
        expect(screen.getByLabelText("Notes")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save notes & decisions" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Configuration" }));

        expect(screen.queryByLabelText("Decision status")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Notes")).not.toBeInTheDocument();
        expect(screen.getByText("Save run configuration")).toBeInTheDocument();
    });

    it("saves notes and decisions from the notes section", async () => {
        renderPropertyDetailPage();

        fireEvent.click(await screen.findByRole("button", { name: "Notes & Decisions" }));
        fireEvent.change(screen.getByLabelText("Target price"), { target: { value: "210000" } });
        fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Proceed if the seller accepts a quick close." } });

        fireEvent.click(screen.getByRole("button", { name: "Save notes & decisions" }));

        await waitFor(() => {
            expect(updatePropertyMock).toHaveBeenCalledWith("prop_1", expect.objectContaining({
                metadata: expect.objectContaining({
                    acquisition_notes: "Proceed if the seller accepts a quick close.",
                    target_price: 210000,
                }),
            }));
        });
    });

    it("saves structured duration controls as schedule seconds", async () => {
        renderPropertyDetailPage();

        fireEvent.click(await screen.findByRole("button", { name: "Configuration" }));

        const scheduleInput = document.querySelector<HTMLInputElement>("#prop-schedule-value");
        const scheduleUnit = document.querySelector<HTMLSelectElement>("#prop-schedule-unit");
        expect(scheduleInput).not.toBeNull();
        expect(scheduleUnit).not.toBeNull();

        fireEvent.change(scheduleInput as HTMLInputElement, { target: { value: "1" } });
        fireEvent.change(scheduleUnit as HTMLSelectElement, { target: { value: "hours" } });

        fireEvent.click(screen.getByRole("button", { name: "Save run configuration" }));

        await waitFor(() => {
            expect(updatePropertyMock).toHaveBeenCalledWith("prop_1", expect.objectContaining({
                schedule_interval_seconds: 3600,
            }));
        });
    });

    it("creates a property from the minimal URL-first flow", async () => {
        listSourcesMock.mockResolvedValue([{ id: "source_1", name: "Listing template" }]);
        createPropertyMock.mockResolvedValue({ ...PROPERTY, id: "prop_new", label: "Manual property", source_id: "source_1", url: "https://example.com/listing" });

        renderPropertyCreatePage();

        expect(await screen.findByRole("button", { name: "Review source fields" })).toBeInTheDocument();
        expect(screen.queryByLabelText("Notes")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Target price")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Run interval")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create Property" })).toBeDisabled();
        fireEvent.change(screen.getByRole("textbox", { name: /URL/ }), { target: { value: "https://example.com/listing" } });
        fireEvent.change(document.querySelector("#prop-source") as HTMLSelectElement, { target: { value: "source_1" } });
        fireEvent.click(screen.getByRole("button", { name: "Create Property" }));

        await waitFor(() => {
            expect(createPropertyMock).toHaveBeenCalledWith(expect.objectContaining({
                label: "",
                manual_data: undefined,
                metadata: expect.objectContaining({
                    tracking_mode: "automatic",
                }),
                schedule_interval_seconds: 0,
                source_id: "source_1",
                url: "https://example.com/listing",
            }));
        });
        expect(await screen.findByText("Properties list")).toBeInTheDocument();
    });

    it("moves the create action below selector configuration when the price selector flow is enabled", async () => {
        renderPropertyCreatePage();

        await screen.findByRole("button", { name: "Review source fields" });
        expect(screen.getByRole("button", { name: "Create Property" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Review source fields" }));

        const selectorSection = screen.getByText("Source & extraction configuration").closest("section");
        expect(selectorSection).not.toBeNull();
        expect(screen.getByRole("button", { name: "Show help for Source fields" })).toBeInTheDocument();
        expect(selectorSection?.querySelector('button[type="submit"]')?.textContent).toBe("Create Property");
        expect(document.querySelectorAll('form#property-create-form button[type="submit"]').length).toBe(0);
    });

    it("blocks submission when the optional URL is invalid", async () => {
        renderPropertyCreatePage();

        await screen.findByRole("button", { name: "Review source fields" });
        fireEvent.change(screen.getByRole("textbox", { name: /URL/ }), { target: { value: "notaurl" } });

        expect(await screen.findByText("Enter a valid http:// or https:// URL.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create Property" })).toBeDisabled();
        expect(createPropertyMock).not.toHaveBeenCalled();
    });

    it("hides automation setup and saves flexible attributes in manual tracking mode", async () => {
        createPropertyMock.mockResolvedValue({ ...PROPERTY, id: "prop_new", label: "Manual listing", metadata: { tracking_mode: "manual" }, url: "" });
        renderPropertyCreatePage();

        fireEvent.click(await screen.findByLabelText("Manual Tracking"));
        fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Manual listing" } });
        expect(screen.queryByLabelText("URL")).not.toBeInTheDocument();
        expect(screen.queryByText("Source template")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Review source fields" })).not.toBeInTheDocument();
        fireEvent.change(screen.getAllByLabelText("Snapshot value")[0] as HTMLInputElement, { target: { value: "275000" } });
        fireEvent.click(screen.getByRole("button", { name: "Create Property" }));

        await waitFor(() => {
            expect(createPropertyMock).toHaveBeenCalledWith(expect.objectContaining({
                label: "Manual listing",
                manual_data: expect.objectContaining({ price: 275000 }),
                metadata: expect.objectContaining({ tracking_mode: "manual" }),
                source_id: undefined,
                url: "",
            }));
        });
    });

    it("shows tags and alerts inside configuration instead of notes and decisions", async () => {
        listPropertyTagsMock.mockResolvedValue([{
            color: "#3b82f6",
            created_at: "2025-01-01",
            id: "tag_1",
            name: "High Priority",
            updated_at: "2025-01-01",
        }]);

        renderPropertyDetailPage();

        fireEvent.click(await screen.findByRole("button", { name: "Configuration" }));
        expect(await screen.findByText("Tags")).toBeInTheDocument();
        expect(screen.getByText("Alerts")).toBeInTheDocument();
        expect(screen.getByLabelText("Tag: High Priority")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Notes & Decisions" }));
        expect(screen.queryByLabelText("Tag: High Priority")).not.toBeInTheDocument();
        expect(screen.queryByText("Alerts")).not.toBeInTheDocument();
    });

    it("auto-fills structured details from a linked source template without overwriting price", async () => {
        listSourcesMock.mockResolvedValue([{
            config_json: JSON.stringify({
                fields: [
                    { extraction_mode: "text", name: "price", required: true, selector_type: "css", selector_value: ".price" },
                    { extraction_mode: "text", name: "rooms", required: false, selector_type: "css", selector_value: ".rooms" },
                    { extraction_mode: "text", name: "bathrooms", required: false, selector_type: "css", selector_value: ".bathrooms" },
                    { extraction_mode: "text", name: "area_m2", required: false, selector_type: "css", selector_value: ".area" },
                ],
            }),
            id: "source_1",
            name: "Idealista template",
        }]);
        previewExtractionMock.mockResolvedValue({
            failures: [],
            fields: [],
            success: true,
            values: {
                area_m2: "120",
                bathrooms: "2",
                price: "350000",
                rooms: "4",
            },
        });

        renderPropertyCreatePage();

        await screen.findByRole("button", { name: "Review source fields" });
        await screen.findByText("Idealista template");
        fireEvent.change(document.querySelector("#prop-source") as HTMLSelectElement, { target: { value: "source_1" } });
        fireEvent.change(screen.getByRole("textbox", { name: /URL/ }), { target: { value: "https://example.com/listing" } });

        await waitFor(() => {
            expect(previewExtractionMock).toHaveBeenCalledWith(expect.objectContaining({
                url: "https://example.com/listing",
            }));
        });
        expect(screen.queryByRole("spinbutton", { name: "Rooms" })).not.toBeInTheDocument();
    });

    it("auto-loads template fields and warns when a template-derived field is modified", async () => {
        listSourcesMock.mockResolvedValue([{
            config_json: JSON.stringify({
                fields: [
                    { extraction_mode: "text", name: "price", required: true, selector_type: "css", selector_value: ".price" },
                    { extraction_mode: "text", name: "rooms", required: false, selector_type: "css", selector_value: ".rooms" },
                ],
            }),
            id: "source_1",
            name: "Idealista template",
        }]);

        renderPropertyCreatePage();

        fireEvent.click(await screen.findByRole("button", { name: "Review source fields" }));
        fireEvent.change(document.querySelector("#prop-source") as HTMLSelectElement, { target: { value: "source_1" } });

        await waitFor(() => {
            expect(screen.getByText("rooms")).toBeInTheDocument();
            expect(screen.getAllByText("template:matched").length).toBeGreaterThan(0);
        });

        fireEvent.click(screen.getByRole("button", { name: "Modify first field" }));

        expect(await screen.findByText("Template link removed for this property.")).toBeInTheDocument();
    });

    it("checks automatic URLs without requiring a manual price override", async () => {
        listSourcesMock.mockResolvedValue([{
            config_json: JSON.stringify({
                fields: [
                    { extraction_mode: "text", name: "price", required: true, selector_type: "css", selector_value: ".price" },
                ],
            }),
            id: "source_1",
            name: "Idealista template",
        }]);
        previewExtractionMock
            .mockResolvedValueOnce({
                failures: [],
                fields: [],
                success: true,
                values: {
                    price: "350000",
                },
            })
            .mockResolvedValueOnce({
                failures: [],
                fields: [],
                success: true,
                values: {
                    price: "360000",
                },
            });

        renderPropertyCreatePage();

        await screen.findByRole("button", { name: "Review source fields" });
        await screen.findByText("Idealista template");
        fireEvent.change(document.querySelector("#prop-source") as HTMLSelectElement, { target: { value: "source_1" } });
        fireEvent.change(screen.getByRole("textbox", { name: /URL/ }), { target: { value: "https://example.com/listing" } });

        await waitFor(() => {
            expect(previewExtractionMock).toHaveBeenCalledTimes(1);
        });
        fireEvent.change(screen.getByRole("textbox", { name: /URL/ }), { target: { value: "https://example.com/listing?refresh=1" } });

        await waitFor(() => {
            expect(previewExtractionMock).toHaveBeenCalledTimes(2);
        });
        expect(screen.queryByLabelText("Price")).not.toBeInTheDocument();
    });
});
