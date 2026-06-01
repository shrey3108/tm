import { adminStageTemplateService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

/**
 * @param skip number of records to skip
 * @param limit number of records to fetch
 * @param q query string
 */
export const useJobStage = (skip: number, limit: number, q: string) => {
    const res = useQuery({
        queryKey: ["stages", skip, limit, q],
        queryFn: () => adminStageTemplateService.getAllTemplates(skip, limit, q),
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 // 1 minute
    })

    return {
        data: res.data?.data ?? [],
        loading: res.isLoading,
        error: res.error,
        refetch: res.refetch,
        total: res.data?.total ?? 0
    }
}