import { adminSystemService } from "@/apis/admin/admin-system";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * @param pattern pattern to search in cache keys
 * @param enableQuery enable query
 */
export const useGetAllCacheKeys = ({ pattern, enableQuery }: { pattern?: string, enableQuery: boolean }) => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.CLEAR_CACHE, pattern],
        queryFn: () => adminSystemService.getAllKeys(pattern),
        enabled: enableQuery,
        gcTime: QUERY_CONFIG.CLEAR_CACHE.gcTime,
        staleTime: QUERY_CONFIG.CLEAR_CACHE.staleTime,
        select: ((data) => {
            return {
                data: data?.data?.keys?.filter((key) => !key.includes("_kombu") && !key.includes("_celery") && !key.includes("unacked") && !key.includes("celery") && !key.includes("kombu") && !key.includes("LIMITS:LIMITER")) || [], // remove celery, kombu, and rate limiter keys
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