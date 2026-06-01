import jobService from "@/apis/job";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";

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
    staleTime: 1000 * 60, // 1 minute
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};
