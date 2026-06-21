import { adminCriteriaService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * @param skip number of records to skip
 * @param limit number of records to fetch
 * @param q query string
 */
export const useJobCriteria = (skip: number = 0, limit: number = 10, q: string = "") => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.CRITERIA, skip, limit, q],
        queryFn: () => adminCriteriaService.getAllCriteria(skip, limit, q),
        placeholderData: keepPreviousData,
        staleTime: QUERY_CONFIG.JOB_CRITERIA.staleTime
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
 * @param criterionId Criterion ID
 */
export const useJobCriteriaById = (criterionId: string) => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.CRITERIA, criterionId],
        queryFn: () => adminCriteriaService.getCriterionById(criterionId),
        placeholderData: keepPreviousData,
        staleTime: QUERY_CONFIG.JOB_CRITERIA.staleTime,
        enabled: !!criterionId,
    })

    return {
        data: res.data,
        loading: res.isLoading,
        error: res.error,
        refetch: res.refetch
    }
}