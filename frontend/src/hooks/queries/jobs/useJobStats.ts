import jobService from "@/apis/job";
import { useQuery } from "@tanstack/react-query";

export const useJobStats = (
  jobId: string | null | undefined,
  filters?: {
    start_date?: Date;
    end_date?: Date;
  }
) => {
  const res = useQuery({
    queryKey: ["jobStats", jobId, filters],
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
