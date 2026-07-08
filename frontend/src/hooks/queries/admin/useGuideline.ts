import { adminGuidelineService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * Hook to get paginated and filtered list of guidelines.
 * @param params - Object containing skip, limit, and search query q
 */
export const useGuidelines = ({ skip = 0, limit = 10, q }: { skip?: number; limit?: number; q?: string } = {}) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.GUIDELINES, skip, limit, q],
    queryFn: () => adminGuidelineService.getAllGuidelines({ skip, limit, q }),
    placeholderData: keepPreviousData,
    staleTime: QUERY_CONFIG.GUIDELINE.staleTime,
  });

  return {
    data: res.data?.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
    total: res.data?.total ?? 0,
  };
};

/**
 * Hook to get a specific guideline by ID.
 * @param id Guideline UUID
 */
export const useGuidelineById = (id: string) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.GUIDELINE_DETAIL, id],
    queryFn: () => adminGuidelineService.getGuidelineById(id),
    enabled: !!id,
    staleTime: QUERY_CONFIG.GUIDELINE.staleTime,
  });

  return {
    data: res.data,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};
