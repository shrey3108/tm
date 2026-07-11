import apiClient from "@/apis/client";
import type { LocationRead, PaginatedResponse } from "@/types/admin";

/**
 * Service for managing locations via the admin API.
 */
export const adminLocationService = {
  /**
   * Retrieves all unique locations with optional search and pagination.
   * @param skip - Number of records to skip (default: 0)
   * @param limit - Maximum number of records to return (default: 100)
   * @param q - Optional search query to filter locations by name
   * @param jobId - Optional job ID to filter locations by job
   */
  getAllLocations: async (
    { skip = 0, limit = 10, q, jobId }: { skip?: number; limit?: number; q?: string; jobId?: string }
  ): Promise<PaginatedResponse<LocationRead>> => {
    const response = await apiClient.get<PaginatedResponse<LocationRead>>(
      "/locations",
      {
        params: {
          skip,
          limit,
          q: q ? q : undefined,
          job_id: jobId ? jobId : undefined
        },
      },
    );
    return response.data;
  },
};
