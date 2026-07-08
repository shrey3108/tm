import client from "@/apis/client";
import type {
  PaginatedResponse
} from "@/types/admin";
import type {
  JobPositionRead,
  JobPositionCreate,
  JobPositionUpdate,
} from "@/types/jobPosition";
/**
 * Service for managing job positions via the admin API.
 */
export const adminJobPositionService = {
  /**
   * Retrieves all job positions with pagination and optional search.
   * @param skip - Number of records to skip
   * @param limit - Maximum number of records to return
   * @param search - Optional search query
   */
  getAllPositions: async (
    { skip = 0, limit = 10, q }: { skip?: number; limit?: number; q?: string },
  ): Promise<PaginatedResponse<JobPositionRead>> => {
    const response = await client.get<PaginatedResponse<JobPositionRead>>(
      "/job-positions",
      {
        params: { skip, limit, q: q ? q : undefined },
      }
    );
    return response.data;
  },

  /**
   * Creates a new job position.
   * @param data - The job position data (name)
   */
  createPosition: async (data: JobPositionCreate): Promise<JobPositionRead> => {
    const response = await client.post<JobPositionRead>("/job-positions", data);
    return response.data;
  },

  /**
   * Updates an existing job position.
   * @param id - The UUID of the position to update
   * @param data - The updated data
   */
  updatePosition: async (
    id: string,
    data: JobPositionUpdate
  ): Promise<JobPositionRead> => {
    const response = await client.patch<JobPositionRead>(`/job-positions/${id}`, data);
    return response.data;
  },

  /**
   * Deletes a job position.
   * @param id - The UUID of the position to delete
   */
  deletePosition: async (id: string): Promise<void> => {
    await client.delete(`/job-positions/${id}`);
  },
};
