import { adminJobPositionService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";


/**
 * @param skip number of records to skip
 * @param limit number of records to fetch
 * @param q query string
 */
export const useJobPosition = (skip: number = 0, limit: number = 10, q: string = "") => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.POSITIONS, skip, limit, q],
        queryFn: () => adminJobPositionService.getAllPositions(skip, limit, q),
        placeholderData: keepPreviousData,
        staleTime: QUERY_CONFIG.JOB_POSITIONS.staleTime
    })

    return {
        data: res.data?.data ?? [],
        loading: res.isLoading,
        error: res.error,
        refetch: res.refetch,
        total: res.data?.total ?? 0
    }
}