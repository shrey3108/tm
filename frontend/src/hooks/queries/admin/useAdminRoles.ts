import { adminRoleService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

/**
 * @param skip number of records to skip
 * @param limit number of records to fetch
 * @param q query string
 */
export const useAdminRoles = ({ skip, limit, q, isEnable = true }: { skip?: number, limit?: number, q?: string, isEnable?: boolean }) => {
  const res = useQuery({
    queryKey: ["roles", skip, limit, q],
    queryFn: () => adminRoleService.getAllRoles(skip, limit, q),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60, // 1 minute
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
