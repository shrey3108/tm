import apiClient from "@/apis/client";
import type { GuidelineCreate, GuidelineUpdate, GuidelineRead } from "@/types/guideline";

/**
 * Guideline Management APIs
 */
export const adminGuidelineService = {
  /**
   * Get all guidelines with pagination.
   * @param skip - Number of records to skip
   * @param limit - Maximum number of records to return
   * @param search - Search query
   * @returns Promise resolving to guidelines and total count
   */
  getAllGuidelines: async (
    skip: number = 0,
    limit: number = 100,
    search?: string,
  ): Promise<{ data: GuidelineRead[]; total: number }> => {
    const response = await apiClient.get<{ data: GuidelineRead[]; total: number }>("/guidelines", {
      params: { skip, limit, q: search ? search : undefined },
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
   * @param guidelineId - Guideline ID
   * @param guideline - Update payload
   * @returns Promise resolving to updated guideline
   */
  updateGuideline: async (
    guidelineId: string,
    guideline: GuidelineUpdate,
  ): Promise<GuidelineRead> => {
    const response = await apiClient.patch<GuidelineRead>(`/guidelines/${guidelineId}`, guideline);
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
