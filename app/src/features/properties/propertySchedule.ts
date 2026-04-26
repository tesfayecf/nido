export type DurationUnit = "hours" | "minutes" | "seconds";

export interface DurationDraft {
    readonly unit: DurationUnit;
    readonly value: string;
}

const durationUnitSeconds: Record<DurationUnit, number> = {
    hours: 3600,
    minutes: 60,
    seconds: 1,
};

const unitLabels: Record<DurationUnit, string> = {
    hours: "hour",
    minutes: "minute",
    seconds: "second",
};

export const SCHEDULE_PRESETS: readonly DurationDraft[] = [
    { unit: "minutes", value: "1" },
    { unit: "minutes", value: "5" },
    { unit: "minutes", value: "15" },
    { unit: "hours", value: "1" },
];

export const durationDraftFromSeconds = (seconds?: number): DurationDraft => {
    if (seconds === undefined || seconds <= 0) {
        return { unit: "hours", value: "1" };
    }

    if (seconds % durationUnitSeconds.hours === 0) {
        return { unit: "hours", value: String(seconds / durationUnitSeconds.hours) };
    }

    if (seconds % durationUnitSeconds.minutes === 0) {
        return { unit: "minutes", value: String(seconds / durationUnitSeconds.minutes) };
    }

    return { unit: "seconds", value: String(seconds) };
};

export const durationDraftToSeconds = (value: string, unit: DurationUnit): number | null => {
    const parsedValue = Number(value);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        return null;
    }

    return parsedValue * durationUnitSeconds[unit];
};

export const formatDurationFromSeconds = (seconds?: number): string => {
    if (seconds === undefined || seconds <= 0) {
        return "Manual only";
    }

    const { unit, value } = durationDraftFromSeconds(seconds);
    const parsedValue = Number(value);
    const label = unitLabels[unit];
    return `${parsedValue} ${label}${parsedValue === 1 ? "" : "s"}`;
};
