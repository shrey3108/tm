import apiClient from "@/apis/client";
import type { StageTemplateCreate, StageTemplateUpdate, PaginatedResponse } from "@/types/admin";
import type { StageTemplate } from "@/types/stage";

const ADMIN_PATH = import.meta.env.VITE_ADMIN_API_ENDPOINT || "/admin";

/**
 * Stage Template Management APIs (Admin only)
 */
export const adminStageTemplateService = {
  /**
   * Get all stage templates with pagination.
   * @param skip - Number of records to skip
   * @param limit - Maximum number of records to return
   * @param search - Search query
   * @returns Promise resolving to a paginated response of stage templates
   */
  getAllTemplates: async (
    { skip = 0, limit = 10, q }: { skip?: number; limit?: number; q?: string }
  ): Promise<PaginatedResponse<StageTemplate>> => {
    const response = await apiClient.get<PaginatedResponse<StageTemplate>>(
      `${ADMIN_PATH}/stage-templates`,
      {
        params: { skip, limit, q: q ? q : undefined },
      }
    );
    return response.data;
  },

  /**
   * Create a new stage template.
   * @param template - Payload for creating a template
   * @returns Promise resolving to the created template
   */
  createTemplate: async (template: StageTemplateCreate): Promise<StageTemplate> => {
    const response = await apiClient.post<StageTemplate>(`${ADMIN_PATH}/stage-templates`, template);
    return response.data;
  },

  /**
   * Update an existing stage template.
   * @param id - Template ID
   * @param template - Payload for updating the template
   * @returns Promise resolving to the updated template
   */
  updateTemplate: async (id: string, template: StageTemplateUpdate): Promise<StageTemplate> => {
    const response = await apiClient.patch<StageTemplate>(
      `${ADMIN_PATH}/stage-templates/${id}`,
      template,
    );
    return response.data;
  },

  /**
   * Delete a stage template.
   * @param id - Template ID
   */
  deleteTemplate: async (id: string): Promise<void> => {
    await apiClient.delete(`${ADMIN_PATH}/stage-templates/${id}`);
  },

  /**
   * Get a stage template by ID.
   * @param id - Template ID
   * @returns Promise resolving to the stage template
   */
  getTemplateById: async (id: string): Promise<StageTemplate> => {
    const response = await apiClient.get<StageTemplate>(`${ADMIN_PATH}/stage-templates/${id}`);
    return response.data;
  },
};
