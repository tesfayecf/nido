export interface Tag {
    readonly id: string;
    readonly name: string;
    readonly color: string;
    readonly created_at: string;
    readonly updated_at: string;
}

export interface TagUpsertRequest {
    readonly name: string;
    readonly color: string;
}
