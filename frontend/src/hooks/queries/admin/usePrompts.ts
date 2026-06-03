import { adminPromptService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * @param skip number of records to skip
 * @param limit number of records to fetch
 * @param q query string
 */
export const usePrompts = (skip: number = 0, limit: number = 10, q: string = "") => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.PROMPTS, skip, limit, q],
        queryFn: () => adminPromptService.getAllPrompts(skip, limit, q),
        placeholderData: keepPreviousData,
        staleTime: QUERY_CONFIG.AI_PROMPTS.staleTime
    })

    return {
        data: res.data?.data ?? [],
        loading: res.isLoading,
        error: res.error,
        refetch: res.refetch,
        total: res.data?.total ?? 0
    }
}