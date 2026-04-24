import { apiRequest, type ItemEnvelope, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";

import type { AssignUnmappedFieldRequest, FieldDefinition, FieldDefinitionUsage, UnmappedFieldGroup } from "@/services/fields/fields.types";

export const listFields = async (): Promise<FieldDefinitionUsage[]> => {
    const response = await apiRequest<ListEnvelope<FieldDefinitionUsage>>({
        auth: true,
        path: "/api/v1/backoffice/fields",
    });
    return response.items;
};

export const createField = async (request: Omit<FieldDefinition, "created_at" | "id" | "system_defined" | "updated_at">): Promise<FieldDefinition> => {
    const response = await apiRequest<ItemEnvelope<FieldDefinition>, typeof request>({
        auth: true,
        body: request,
        method: "POST",
        path: "/api/v1/backoffice/fields",
    });
    return response.item;
};

export const updateField = async (fieldId: string, request: Partial<FieldDefinition>): Promise<FieldDefinition> => {
    const response = await apiRequest<ItemEnvelope<FieldDefinition>, Partial<FieldDefinition>>({
        auth: true,
        body: request,
        method: "PUT",
        path: `/api/v1/backoffice/fields/${fieldId}`,
    });
    return response.item;
};

export const deleteField = async (fieldId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/backoffice/fields/${fieldId}`,
    });
};

export const listUnmappedFields = async (): Promise<UnmappedFieldGroup[]> => {
    const response = await apiRequest<ListEnvelope<UnmappedFieldGroup>>({
        auth: true,
        path: "/api/v1/backoffice/fields/unmapped",
    });
    return response.items;
};

export const assignUnmappedField = async (request: AssignUnmappedFieldRequest): Promise<void> => {
    await apiRequest<StatusEnvelope, AssignUnmappedFieldRequest>({
        auth: true,
        body: request,
        method: "POST",
        path: "/api/v1/backoffice/fields/unmapped/assign",
    });
};
