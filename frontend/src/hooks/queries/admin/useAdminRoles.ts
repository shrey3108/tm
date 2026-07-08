import { adminRoleService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * @param params - Object containing skip, limit, q, and enabled flag
 */
export const useAdminRoles = ({ skip = 0, limit = 10, q = "", isEnable = true }: { skip?: number, limit?: number, q?: string, isEnable?: boolean } = {}) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.ROLES, skip, limit, q],
    queryFn: () => adminRoleService.getAllRoles({ skip, limit, q }),
    placeholderData: keepPreviousData,
    staleTime: QUERY_CONFIG.ADMIN_ROLES.staleTime,
    enabled: isEnable,
  });

  return {
    data: res.data?.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
    total: res.data?.total ?? 0,
  };
};
