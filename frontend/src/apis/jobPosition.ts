import client from "@/apis/client";
import type { PaginatedResponse } from "@/types/admin";
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
   */
  getAllPositions: async ({
    skip = 0,
    limit = 10,
    q,
  }: {
    skip?: number;
    limit?: number;
    q?: string;
  } = {}): Promise<PaginatedResponse<JobPositionRead>> => {
    const response = await client.get<PaginatedResponse<JobPositionRead>>(
      "/job-positions",
      {
        params: { skip, limit, q: q ? q : undefined },
      }
    );
    return response.data;
  },

  /**
   * Retrieves a job position by ID.
   */
  getPositionById: async (id: string): Promise<JobPositionRead> => {
    const response = await client.get<JobPositionRead>(`/job-positions/${id}`);
    return response.data;
  },

  /**
   * Creates a new job position.
   */
  createPosition: async (data: JobPositionCreate): Promise<JobPositionRead> => {
    const response = await client.post<JobPositionRead>("/job-positions", data);
    return response.data;
  },

  /**
   * Updates an existing job position.
   */
  updatePosition: async ({
    id,
    data,
  }: {
    id: string;
    data: JobPositionUpdate;
  }): Promise<JobPositionRead> => {
    const response = await client.patch<JobPositionRead>(`/job-positions/${id}`, data);
    return response.data;
  },

  /**
   * Deletes a job position.
   */
  deletePosition: async (id: string): Promise<void> => {
    await client.delete(`/job-positions/${id}`);
  },
};
