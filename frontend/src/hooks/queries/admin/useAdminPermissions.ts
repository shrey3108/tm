import { adminPermissionService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * Hook for fetching all permissions.
 * @param isEnable - Whether the query should be enabled (default: true)
 */
export const useAdminPermissions = ({ isEnable = true }: { isEnable?: boolean } = {}) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.PERMISSIONS],
    queryFn: () => adminPermissionService.getAllPermissions(),
    placeholderData: keepPreviousData,
    staleTime: QUERY_CONFIG.ADMIN_PERMISSIONS.staleTime,
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
