interface EmptyStateProps {
    readonly message: string;
}

/**
 * Renders a consistent empty-data message.
 *
 * @param props The empty-state message.
 * @returns A compact empty-state container.
 */
export const EmptyState = ({ message }: EmptyStateProps): JSX.Element => {
    return <div className={"empty-state"}>{message}</div>;
};