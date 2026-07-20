import { adminDesignationService } from "@/apis/designation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for fetching all designations.
 */
export const useDesignations = () => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.DESIGNATIONS],
    queryFn: () => adminDesignationService.getAllDesignations(),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: res.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
    total: res.data?.length ?? 0,
  };
};
