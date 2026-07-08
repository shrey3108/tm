import apiClient from "@/apis/client";
import type { GuidelineCreate, GuidelineUpdate, GuidelineRead } from "@/types/guideline";

/**
 * Guideline Management APIs
 */
export const adminGuidelineService = {
  /**
   * Get all guidelines with pagination.
   * @param params - Query parameters (skip, limit, q)
   * @returns Promise resolving to guidelines and total count
   */
  getAllGuidelines: async ({ skip = 0, limit = 10, q }: { skip?: number; limit?: number; q?: string }): Promise<{ data: GuidelineRead[]; total: number }> => {
    const response = await apiClient.get<{ data: GuidelineRead[]; total: number }>("/guidelines", {
      params: { skip, limit, q: q ? q : undefined },
    });
    return response.data;
  },

  /**
   * Create a new guideline.
   * @param guideline - Guideline creation payload
   * @returns Promise resolving to created guideline
   */
  createGuideline: async (guideline: GuidelineCreate): Promise<GuidelineRead> => {
    const response = await apiClient.post<GuidelineRead>("/guidelines", guideline);
    return response.data;
  },

  /**
   * Get guideline details by ID.
   * @param guidelineId - Guideline ID
   * @returns Promise resolving to guideline details
   */
  getGuidelineById: async (guidelineId: string): Promise<GuidelineRead> => {
    const response = await apiClient.get<GuidelineRead>(`/guidelines/${guidelineId}`);
    return response.data;
  },

  /**
   * Update an existing guideline.
   * @param payload - Payload containing ID and update fields
   * @returns Promise resolving to updated guideline
   */
  updateGuideline: async ({
    id,
    data,
  }: {
    id: string;
    data: GuidelineUpdate;
  }): Promise<GuidelineRead> => {
    const response = await apiClient.patch<GuidelineRead>(`/guidelines/${id}`, data);
    return response.data;
  },

  /**
   * Delete a guideline.
   * @param guidelineId - Guideline ID
   */
  deleteGuideline: async (guidelineId: string): Promise<void> => {
    await apiClient.delete(`/guidelines/${guidelineId}`);
  },
};
