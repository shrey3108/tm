import { adminJobPositionService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * @param params - Object containing skip, limit, and search query q
 */
export const useJobPosition = ({ skip = 0, limit = 10, q }: { skip?: number; limit?: number; q?: string } = {}) => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.POSITIONS, skip, limit, q],
        queryFn: () => adminJobPositionService.getAllPositions({ skip, limit, q }),
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

/**
 * @param positionId Job Position ID
 */
export const useJobPositionById = (positionId: string) => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.POSITIONS, positionId],
        queryFn: () => adminJobPositionService.getPositionById(positionId),
        placeholderData: keepPreviousData,
        staleTime: QUERY_CONFIG.JOB_POSITIONS.staleTime,
        enabled: !!positionId,
    })

    return {
        data: res.data,
        loading: res.isLoading,
        error: res.error,
        refetch: res.refetch
    }
}