import { adminAssociateService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * Hook to get paginated and filtered list of associates.
 * @param params - Object containing skip, limit, and search query q
 */
export const useAssociates = ({
  skip = 0,
  limit = 10,
  q,
  designation_id,
}: {
  skip?: number;
  limit?: number;
  q?: string;
  designation_id?: string;
} = {}) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.ASSOCIATES, skip, limit, q, designation_id],
    queryFn: () => adminAssociateService.getAllAssociates({ skip, limit, q, designation_id }),
    placeholderData: keepPreviousData,
    staleTime: QUERY_CONFIG.ASSOCIATE.staleTime,
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
 * Hook to get a specific associate by ID.
 * @param id Associate UUID
 */
export const useAssociateById = (id: string) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.ASSOCIATE_DETAIL, id],
    queryFn: () => adminAssociateService.getAssociateById(id),
    enabled: !!id,
    staleTime: QUERY_CONFIG.ASSOCIATE.staleTime,
  });

  return {
    data: res.data,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};
