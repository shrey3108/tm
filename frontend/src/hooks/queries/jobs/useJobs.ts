import jobService from "@/apis/job";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

export const useJobs = (
  skip: number = 0,
  limit: number = 10,
  filters?: {
    q?: string;
    status?: boolean | boolean[];
    department_id?: string | string[];
  }
) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.JOBS.LIST, skip, limit, filters],
    queryFn: () => jobService.getJobs(skip, limit, filters),
    placeholderData: keepPreviousData,
    staleTime: QUERY_CONFIG.JOBS_LIST.staleTime,
  });

  return {
    data: res.data?.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
    total: res.data?.total ?? 0,
  };
};
