interface StatusBadgeProps {
    readonly tone: "danger" | "neutral" | "success" | "warning";
    readonly value: string;
}

/**
 * Renders a compact semantic status badge.
 *
 * @param props The status label and tone.
 * @returns A styled status badge.
 */
export const StatusBadge = ({ tone, value }: StatusBadgeProps): JSX.Element => {
    return <span className={`status-badge status-badge--${tone}`}>{value}</span>;
};