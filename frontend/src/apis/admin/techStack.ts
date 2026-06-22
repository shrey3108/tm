import apiClient from "@/apis/client";
import type { PaginatedResponse, TechStackCreate, TechStackRead, TechStackUpdate } from "@/types/admin";

/**
 * Service for managing tech stacks via the admin API.
 */
export const adminTechStackService = {
  /**
   * Retrieves all tech stacks with optional pagination and search.
   * @param skip - Number of records to skip (default: 0)
   * @param limit - Maximum number of records to return (default: 100)
   * @param search - Search query to filter tech stacks by name
   */
  getAllTechStacks: async (
    skip = 0,
    limit = 100,
    search?: string,
  ): Promise<PaginatedResponse<TechStackRead>> => {
    const response = await apiClient.get<PaginatedResponse<TechStackRead>>(
      "/tech-stacks",
      {
        params: { skip, limit, q: search ? search : undefined },
      },
    );
    return response.data;
  },

  /**
   * Retrieves a single tech stack by its ID.
   * @param techStackId - UUID of the tech stack to retrieve
   */
  getTechStackById: async (techStackId: string): Promise<TechStackRead> => {
    const response = await apiClient.get<TechStackRead>(`/tech-stacks/${techStackId}`);
    return response.data;
  },

  /**
   * Creates a new tech stack.
   * @param data - Tech stack creation payload
   */
  createTechStack: async (data: TechStackCreate): Promise<TechStackRead> => {
    const response = await apiClient.post<TechStackRead>("/tech-stacks", data);
    return response.data;
  },

  /**
   * Updates an existing tech stack.
   * @param techStackId - UUID of the tech stack to update
   * @param data - Fields to update
   */
  updateTechStack: async (
    techStackId: string,
    data: TechStackUpdate,
  ): Promise<TechStackRead> => {
    const response = await apiClient.patch<TechStackRead>(`/tech-stacks/${techStackId}`, data);
    return response.data;
  },

  /**
   * Deletes a tech stack by its ID.
   * @param techStackId - UUID of the tech stack to delete
   */
  deleteTechStack: async (techStackId: string): Promise<void> => {
    await apiClient.delete(`/tech-stacks/${techStackId}`);
  },
};
