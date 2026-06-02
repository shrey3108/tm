import { adminJobService } from "@/apis/admin";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook to fetch detailed analysis for a specific job resume.
 */
export function useAdminJobResumeDetailQuery(
  jobId: string | undefined,
  resumeId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [QUERY_KEYS.JOBS.DETAIL, jobId, "resume-analysis", resumeId],
    queryFn: () => {
      if (!jobId || !resumeId) throw new Error("jobId and resumeId are required");
      return adminJobService.getJobResumeDetail(jobId, resumeId);
    },
    ...options,
    enabled: (options?.enabled ?? true) && !!jobId && !!resumeId,
  });
}
