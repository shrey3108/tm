import { adminJobService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

export const useAdminJobs = (
  skip: number = 0,
  limit: number = 10,
  filters?: {
    q?: string;
    status?: boolean | boolean[];
    department_id?: string | string[];
  }
) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.JOBS.ADMIN_LIST, skip, limit, filters],
    queryFn: () => adminJobService.getAllJobs(skip, limit, filters),
    placeholderData: keepPreviousData,
    staleTime: QUERY_CONFIG.ADMIN_JOBS.staleTime,
  });

  return {
    data: res.data?.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
    total: res.data?.total ?? 0,
  };
};
