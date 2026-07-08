import client from "@/apis/client";
import type { PaginatedResponse } from "@/types/admin";
import type { JobPriorityRead } from "@/types/jobPriority";

/**
 * Service for managing job priorities in the admin panel.
 */
export const adminJobPriorityService = {
  /**
   * Retrieves all job priorities with pagination.
   * @param params - Query parameters (skip, limit, q)
   * @returns Promise resolving to job priorities and total count
   */
  getAllPriorities: async ({ skip = 0, limit = 10, q }: { skip?: number; limit?: number; q?: string },): Promise<PaginatedResponse<JobPriorityRead>> => {
    const response = await client.get<PaginatedResponse<JobPriorityRead>>(
      "/job-priorities",
      {
        params: { skip, limit, q: q ? q : undefined },
      }
    );
    return response.data;
  },

  /**
   * Retrieves a job priority by ID.
   * @param id - The UUID of the priority
   */
  getPriorityById: async (id: string): Promise<JobPriorityRead> => {
    const response = await client.get<JobPriorityRead>(`/job-priorities/${id}`);
    return response.data;
  },

  /**
   * Creates a new job priority.
   * @param data - The priority data (duration_days, associate_reminder_hours)
   * @returns Promise resolving to the created priority
   */
  createPriority: async (data: { duration_days: number; associate_reminder_hours?: number }): Promise<JobPriorityRead> => {
    const response = await client.post<JobPriorityRead>("/job-priorities", data);
    return response.data;
  },

  /**
   * Updates an existing job priority.
   * @param payload - Payload containing ID and update fields
   * @returns Promise resolving to the updated priority
   */
  updatePriority: async ({
    id,
    data,
  }: {
    id: string;
    data: { duration_days?: number; associate_reminder_hours?: number };
  }): Promise<JobPriorityRead> => {
    const response = await client.patch<JobPriorityRead>(`/job-priorities/${id}`, data);
    return response.data;
  },

  /**
   * Deletes a job priority.
   * @param id - The UUID of the priority to delete
   */
  deletePriority: async (id: string): Promise<void> => {
    await client.delete(`/job-priorities/${id}`);
  },
};
