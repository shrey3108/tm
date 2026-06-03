import { adminRoleService } from "@/apis/admin";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * Hook for fetching a single role by ID with its permissions.
 * @param roleId - The role ID to fetch (null/undefined disables the query)
 */
export const useAdminRoleById = (roleId?: string | null) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.ROLES, "detail", roleId],
    queryFn: () => adminRoleService.getRoleById(roleId!),
    staleTime: QUERY_CONFIG.ADMIN_ROLE_DETAIL.staleTime,
    enabled: !!roleId,
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};
