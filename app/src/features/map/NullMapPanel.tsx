import { PageCard } from "@/components/ui/PageCard";
import { nullMapAdapter } from "@/features/map/MapAdapter";

/**
 * Explains why the map is deferred in iteration 1.
 *
 * @returns A placeholder panel describing the current map limitation.
 */
export const NullMapPanel = (): JSX.Element => {
    return (
        <PageCard
            description={"The map boundary exists now so future geospatial support can be added without reworking the shell."}
            title={"Map View Deferred"}
        >
            <p className={"muted-copy"}>{nullMapAdapter.reason}</p>
        </PageCard>
    );
};