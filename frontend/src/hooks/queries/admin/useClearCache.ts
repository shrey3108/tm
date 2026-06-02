import { adminSystemService } from "@/apis/admin/admin-system";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * @param pattern pattern to search in cache keys
 */
export const useGetAllCacheKeys = ({ pattern, enableQuery }: { pattern?: string, enableQuery: boolean }) => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.CLEAR_CACHE, pattern],
        queryFn: () => adminSystemService.getAllKeys(pattern),
        enabled: enableQuery,
        gcTime: 0, // always fetch fresh
        staleTime: 0, // always fetch fresh
        select: ((data) => {
            return {
                data: data?.data?.keys?.filter((key) => !key.includes("_kombu") && !key.includes("_celery")) || [], // remove celery and kombu keys
                total: data.data.total_count ?? 0
            }
        })
    })

    return {
        data: res.data?.data,
        total: res.data?.total,
        loading: res.isLoading,
        error: res.error,
        refetch: res.refetch,
    }
}