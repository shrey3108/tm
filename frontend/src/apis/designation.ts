import client from "@/apis/client";
import type { DesignationRead, DesignationCreate, DesignationUpdate } from "@/types/designation";
import type { PaginatedResponse } from "@/types/admin";

/**
 * Service for managing designations via the admin API.
 */
export const adminDesignationService = {
  /**
   * Retrieves designations with server-side pagination, count, and search query.
   */
  getAllDesignations: async ({
    skip = 0,
    limit = 10,
    q,
  }: {
    skip?: number;
    limit?: number;
    q?: string;
  } = {}): Promise<PaginatedResponse<DesignationRead>> => {
    const response = await client.get<PaginatedResponse<DesignationRead>>("/designations", {
      params: { skip, limit, q: q ? q : undefined },
    });
    return response.data;
  },

  /**
   * Creates a new designation.
   */
  createDesignation: async (data: DesignationCreate): Promise<DesignationRead> => {
    const response = await client.post<DesignationRead>("/designations", data);
    return response.data;
  },

  /**
   * Updates an existing designation.
   */
  updateDesignation: async ({
    id,
    data,
  }: {
    id: string;
    data: DesignationUpdate;
  }): Promise<DesignationRead> => {
    const response = await client.put<DesignationRead>(`/designations/${id}`, data);
    return response.data;
  },

  /**
   * Deletes a designation by ID.
   */
  deleteDesignation: async (id: string): Promise<void> => {
    await client.delete(`/designations/${id}`);
  },
};
