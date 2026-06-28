import apiClient from "@/apis/client";
import type { AssociateCreate, AssociateUpdate } from "@/types/associate";
import type { AssociateRead } from "@/types/associate";

/**
 * Associate Management APIs
 */
export const adminAssociateService = {
  /**
   * Get all associates with pagination.
   * @param skip - Number of records to skip
   * @param limit - Maximum number of records to return
   * @param search - Search query
   * @returns Promise resolving to associates and total count
   */
  getAllAssociates: async (
    skip: number = 0,
    limit: number = 100,
    search?: string,
  ): Promise<{ data: AssociateRead[]; total: number }> => {
    const response = await apiClient.get<{ data: AssociateRead[]; total: number }>("/associates", {
      params: { skip, limit, q: search ? search : undefined },
    });
    return response.data;
  },

  /**
   * Create a new associate.
   * @param associate - Associate creation payload
   * @returns Promise resolving to created associate
   */
  createAssociate: async (associate: AssociateCreate): Promise<AssociateRead> => {
    const response = await apiClient.post<AssociateRead>("/associates", associate);
    return response.data;
  },

  /**
   * Get associate details by ID.
   * @param associateId - Associate ID
   * @returns Promise resolving to associate details
   */
  getAssociateById: async (associateId: string): Promise<AssociateRead> => {
    const response = await apiClient.get<AssociateRead>(`/associates/${associateId}`);
    return response.data;
  },

  /**
   * Update an existing associate.
   * @param associateId - Associate ID
   * @param associate - Update payload
   * @returns Promise resolving to updated associate
   */
  updateAssociate: async (
    associateId: string,
    associate: AssociateUpdate,
  ): Promise<AssociateRead> => {
    const response = await apiClient.patch<AssociateRead>(`/associates/${associateId}`, associate);
    return response.data;
  },

  /**
   * Delete an associate.
   * @param associateId - Associate ID
   */
  deleteAssociate: async (associateId: string): Promise<void> => {
    await apiClient.delete(`/associates/${associateId}`);
  },
};
