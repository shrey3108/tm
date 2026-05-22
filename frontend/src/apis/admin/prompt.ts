
import type { PromptRead } from "@/types/admin";
import apiClient from "../client";
const ADMIN_PATH = import.meta.env.VITE_ADMIN_API_ENDPOINT || "/admin";
/**
 * Service for managing admin prompts.
 */
export const adminPromptService = {
  /**
   * Fetches all prompts from the admin API.
   * @returns A promise that resolves to an array of prompts.
   * NOTE: FOR NOW SKIP AND LIMIT ARE UTILIZE BY THE API
   */
  getAllPrompts: async (skip: number, limit: number, q?: string): Promise<PromptRead[]> => {
    const response = await apiClient.get<{ data: PromptRead[] }>(`${ADMIN_PATH}/prompts`, {
      params: {
        skip,
        limit,
        q: q === "" ? undefined : q
      }
    });
    return response.data.data;
  },
};
