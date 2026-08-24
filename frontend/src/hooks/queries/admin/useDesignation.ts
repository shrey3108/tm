import { adminDesignationService } from "@/apis/designation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for fetching paginated and filtered list of designations.
 */
export const useDesignations = ({
  skip = 0,
  limit = 100,
  q,
}: {
  skip?: number;
  limit?: number;
  q?: string;
} = {}) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.DESIGNATIONS, skip, limit, q],
    queryFn: () => adminDesignationService.getAllDesignations({ skip, limit, q }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: res.data?.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
    total: res.data?.total ?? 0,
  };
};
