import { adminRoleService } from "@/apis/admin";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for fetching a single role by ID with its permissions.
 * @param roleId - The role ID to fetch (null/undefined disables the query)
 */
export const useAdminRoleById = (roleId?: string | null) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.ROLES, "detail", roleId],
    queryFn: () => adminRoleService.getRoleById(roleId!),
    staleTime: 1000 * 60, // 1 minute
    enabled: !!roleId,
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};
