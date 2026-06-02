import { adminRoleService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * @param skip number of records to skip
 * @param limit number of records to fetch
 * @param q query string
 */
export const useAdminRoles = ({ skip = 0, limit = 10, q = "", isEnable = true }: { skip?: number, limit?: number, q?: string, isEnable?: boolean } = {}) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.ROLES, skip, limit, q],
    queryFn: () => adminRoleService.getAllRoles(skip, limit, q),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60, // 1 minute
    enabled: isEnable,
    select: ((data) => ({
      data: data.data.filter((role) => role.name.toLowerCase() !== "superadmin"), // remove super admin
      total: data.total - 1
    }))
  });

  return {
    data: res.data?.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
    total: res.data?.total ?? 0,
  };
};
