import { adminJobService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

export const useAdminJobs = (
  skip: number,
  limit: number,
  filters?: {
    q?: string;
    status?: boolean | boolean[];
    department_id?: string | string[];
  }
) => {
  const res = useQuery({
    queryKey: ["adminJobs", skip, limit, filters],
    queryFn: () => adminJobService.getAllJobs(skip, limit, filters),
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
