import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";
import { crossMatchApi } from "@/apis/crossMatch";

/**
 * @param resumeId id of the candidate
 * @param skip number of records to skip
 * @param limit number of records to fetch
 * @param refetchInterval polling interval in ms (or false/undefined)
 */
export const useCandidateCrossJobMatch = (
    resumeId: string,
    skip: number = 0,
    limit: number = 10,
    refetchInterval?: number | false
) => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.CANDIDATES.CROSS_JOB_MATCH, resumeId, skip, limit],
        queryFn: () => crossMatchApi.getCrossMatches(resumeId, skip, limit),
        placeholderData: keepPreviousData,
        staleTime: QUERY_CONFIG.CANDIDATE_CROSS_JOB_MATCH.staleTime,
        refetchInterval
    })

    return {
        data: res.data?.data ?? [],
        loading: res.isLoading,
        error: res.error,
        refetch: res.refetch,
        total: res.data?.total ?? 0
    }
}