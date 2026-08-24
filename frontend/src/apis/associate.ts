import apiClient from "@/apis/client";
import type { AssociateCreate, AssociateUpdate } from "@/types/associate";
import type { AssociateRead } from "@/types/associate";

/**
 * Associate Management APIs
 */
export const adminAssociateService = {
  /**
   * Get all associates with pagination.
   */
  getAllAssociates: async ({
    skip = 0,
    limit = 100,
    q,
    designation_id,
  }: {
    skip?: number;
    limit?: number;
    q?: string;
    designation_id?: string;
  } = {}): Promise<{ data: AssociateRead[]; total: number }> => {
    const response = await apiClient.get<{ data: AssociateRead[]; total: number }>("/associates", {
      params: { skip, limit, q: q ? q : undefined, designation_id: designation_id ? designation_id : undefined },
    });
    return response.data;
  },

  /**
   * Create a new associate.
   */
  createAssociate: async (associate: AssociateCreate): Promise<AssociateRead> => {
    const response = await apiClient.post<AssociateRead>("/associates", associate);
    return response.data;
  },

  /**
   * Get associate details by ID.
   */
  getAssociateById: async (associateId: string): Promise<AssociateRead> => {
    const response = await apiClient.get<AssociateRead>(`/associates/${associateId}`);
    return response.data;
  },

  /**
   * Update an existing associate.
   */
  updateAssociate: async ({
    id,
    data,
  }: {
    id: string;
    data: AssociateUpdate;
  }): Promise<AssociateRead> => {
    const response = await apiClient.patch<AssociateRead>(`/associates/${id}`, data);
    return response.data;
  },

  /**
   * Delete an associate.
   */
  deleteAssociate: async (associateId: string): Promise<void> => {
    await apiClient.delete(`/associates/${associateId}`);
  },
};
