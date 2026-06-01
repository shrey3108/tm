import jobService from "@/apis/job";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

export const useJobs = (
  skip: number,
  limit: number,
  filters?: {
    q?: string;
    status?: boolean | boolean[];
    department_id?: string | string[];
  }
) => {
  const res = useQuery({
    queryKey: ["jobs", skip, limit, filters],
    queryFn: () => jobService.getJobs(skip, limit, filters),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60, // 1 minute
  });

  return {
    data: res.data?.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
    total: res.data?.total ?? 0,
  };
};
