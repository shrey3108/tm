import apiClient from "@/apis/client";
import type { SkillCreate, SkillRead, SkillUpdate } from "@/types/skill";

/**
 * Skill Management APIs
 */
export const adminSkillService = {
  /**
   * Get all skills with pagination.
   * @param skip - Number of records to skip
   * @param limit - Maximum number of records to return
   * @param search - Search query
   * @returns Promise resolving to skills and total count
   */
  getAllSkills: async (
    { skip = 0, limit = 10, q }: { skip?: number; limit?: number; q?: string },
  ): Promise<{ data: SkillRead[]; total: number }> => {
    const response = await apiClient.get<{ data: SkillRead[]; total: number }>("/skills", {
      params: { skip, limit, q: q ? q : undefined },
    });
    return response.data;
  },

  /**
   * Create a new skill.
   * @param skill - Skill creation payload
   * @returns Promise resolving to created skill
   */
  createSkill: async (skill: SkillCreate): Promise<SkillRead> => {
    const response = await apiClient.post<SkillRead>("/skills", skill);
    return response.data;
  },

  /**
   * Get skill details by ID.
   * @param skillId - Skill ID
   * @returns Promise resolving to skill details
   */
  getSkillById: async (skillId: string): Promise<SkillRead> => {
    const response = await apiClient.get<SkillRead>(`/skills/${skillId}`);
    return response.data;
  },

  /**
   * Update an existing skill.
   * @param skillId - Skill ID
   * @param skill - Update payload
   * @returns Promise resolving to updated skill
   */
  updateSkill: async (skillId: string, skill: SkillUpdate): Promise<SkillRead> => {
    const response = await apiClient.patch<SkillRead>(`/skills/${skillId}`, skill);
    return response.data;
  },

  /**
   * Delete a skill.
   * @param skillId - Skill ID
   */
  deleteSkill: async (skillId: string): Promise<void> => {
    await apiClient.delete(`/skills/${skillId}`);
  },
};
