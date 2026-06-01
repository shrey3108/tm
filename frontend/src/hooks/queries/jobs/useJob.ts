import jobService from "@/apis/job";
import { useQuery } from "@tanstack/react-query";

export const useJob = (jobId: string | null | undefined) => {
  const res = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobService.getJob(jobId!),
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

export const useJobTitle = (q?: string, isEnable?: boolean) => {
  const res = useQuery({
    queryKey: ["job", q],
    queryFn: () => jobService.getJobTitles(q),
    staleTime: 1000 * 60, // 1 minute
    enabled: isEnable
  });

  return {
    data: res.data?.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};