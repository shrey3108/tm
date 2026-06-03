import jobService from "@/apis/job";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

export const useJobStats = (
  jobId: string | null | undefined,
  filters?: {
    start_date?: Date;
    end_date?: Date;
  }
) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.JOBS.STATS, jobId, filters],
    queryFn: () => jobService.getJobStats(jobId!, filters),
    enabled: !!jobId,
    staleTime: QUERY_CONFIG.JOB_STATS.staleTime,
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};
