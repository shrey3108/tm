import client from "@/apis/client";
import type { DesignationRead, DesignationCreate, DesignationUpdate } from "@/types/designation";

/**
 * Service for managing designations via the admin API.
 */
export const adminDesignationService = {
  /**
   * Retrieves all designations.
   */
  getAllDesignations: async (): Promise<DesignationRead[]> => {
    const response = await client.get<DesignationRead[]>("/designations");
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
    const response = await client.patch<DesignationRead>(`/designations/${id}`, data);
    return response.data;
  },

  /**
   * Deletes a designation by ID.
   */
  deleteDesignation: async (id: string): Promise<void> => {
    await client.delete(`/designations/${id}`);
  },
};
