import { adminJobPriorityService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * @param skip number of records to skip
 * @param limit number of records to fetch
 * @param q query string
 */
export const useJobPriorities = ({ skip = 0, limit = 10, q }: { skip?: number; limit?: number; q?: string } = {}) => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.JOB_PRIORITIES, skip, limit, q],
        queryFn: () => adminJobPriorityService.getAllPriorities({ skip, limit, q }),
        placeholderData: keepPreviousData,
        staleTime: QUERY_CONFIG.PRIORITY.staleTime
    })

    return {
        data: res.data?.data ?? [],
        loading: res.isLoading,
        error: res.error,
        refetch: res.refetch,
        total: res.data?.total ?? 0
    }
}

/**
 * @param priorityId Priority ID
 */
export const useJobPriorityById = (priorityId: string) => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.JOB_PRIORITIES, priorityId],
        queryFn: () => adminJobPriorityService.getPriorityById(priorityId),
        placeholderData: keepPreviousData,
        staleTime: QUERY_CONFIG.PRIORITY.staleTime,
        enabled: !!priorityId,
    })

    return {
        data: res.data,
        loading: res.isLoading,
        error: res.error,
        refetch: res.refetch
    }
}