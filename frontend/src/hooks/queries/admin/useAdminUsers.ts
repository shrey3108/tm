import { adminUserService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * @param params - Object containing skip, limit, and search query q
 */
export const useAdminUsers = ({ skip = 0, limit = 10, q = "" }: { skip?: number, limit?: number, q?: string } = {}) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.USERS, skip, limit, q],
    queryFn: () => adminUserService.getAllUsers({ skip, limit, q }),
    placeholderData: keepPreviousData,
    staleTime: QUERY_CONFIG.ADMIN_USERS.staleTime,
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
 * @param userId User ID
 */
export const useAdminUserById = (userId: string) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.USERS, userId],
    queryFn: () => adminUserService.getUserById(userId),
    placeholderData: keepPreviousData,
    staleTime: QUERY_CONFIG.ADMIN_USERS.staleTime,
    enabled: !!userId,
  });

  return {
    data: res.data,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};
