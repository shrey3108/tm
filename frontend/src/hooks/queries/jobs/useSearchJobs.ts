import jobService from "@/apis/job";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * Hook for searching jobs.
 * @param query - The search query string
 * @param options - Additional query options
 */
export function useSearchJobsQuery(query: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [QUERY_KEYS.JOBS.LIST, "search", query],
    queryFn: () => jobService.searchJobs(query),
    staleTime: QUERY_CONFIG.SEARCH_JOBS.staleTime,
    ...options,
    enabled: (options?.enabled ?? true) && !!query.trim(),
  });
}
