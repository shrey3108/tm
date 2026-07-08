import apiClient from "@/apis/client";
import type {
  AnalyticsSummary,
  AuditLogRead,
  HiringReport,
  RecentUploadRead,
  PaginatedResponse,
} from "@/types/admin";
import type { JobPipelineStats } from "@/types/job";
const ADMIN_PATH = import.meta.env.VITE_ADMIN_API_ENDPOINT || "/admin";

/**
 * Analytics and Audit APIs
 */
export const adminAnalyticsService = {
  /**
   * Get all audit logs (admin and hr admin only).
   */
  getAuditLogs: async (
    { skip = 0, limit = 10, q }: { skip?: number; limit?: number; q?: string }
  ): Promise<PaginatedResponse<AuditLogRead>> => {
    const response = await apiClient.get<PaginatedResponse<AuditLogRead>>(
      `${ADMIN_PATH}/audit-logs`,
      {
        params: { skip, limit, q: q ? q : undefined },
      }
    );
    return response.data;
  },

  /**
   * Get recent file uploads (admin only).
   */
  getRecentUploads: async (
    { skip = 0, limit = 10, q }: { skip?: number; limit?: number; q?: string }
  ): Promise<PaginatedResponse<RecentUploadRead>> => {
    const response = await apiClient.get<PaginatedResponse<RecentUploadRead>>(
      `${ADMIN_PATH}/recent-uploads`,
      {
        params: { skip, limit, q: q ? q : undefined },
      }
    );
    return response.data;
  },

  /**
   * Get analytics summary (admin and hr admin only).
   */
  getAnalytics: async (): Promise<AnalyticsSummary> => {
    const response = await apiClient.get<AnalyticsSummary>(
      `${ADMIN_PATH}/analytics`
    );
    return response.data;
  },

  /**
   * Get hiring report with detailed statistics (admin and hr admin only).
   */
  getHiringReport: async (
    jobId?: string,
    stageName?: string
  ): Promise<HiringReport> => {
    const response = await apiClient.get<HiringReport>(
      `${ADMIN_PATH}/hiring-report`,
      {
        params: { job_id: jobId, stage_name: stageName },
      }
    );
    return response.data;
  },

  /**
   * Get pipeline completion stats per job/stage.
   */
  getPipelineStats: async (
    jobId?: string,
    stageName?: string
  ): Promise<JobPipelineStats[]> => {
    const response = await apiClient.get<JobPipelineStats[]>(
      `${ADMIN_PATH}/pipeline-stats`,
      {
        params: { job_id: jobId, stage_name: stageName },
      }
    );
    return response.data;
  },
};
