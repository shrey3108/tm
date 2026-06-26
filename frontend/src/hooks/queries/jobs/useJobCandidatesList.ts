import jobService from "@/apis/job";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

export interface CandidateFilters {
  query?: string;
  hr_decision?: string[];
  jd_versions?: number[];
  start_date?: Date;
  end_date?: Date;
  activity_session?: string[];
  stage_id?: string[];
  city?: string[];
  result?: string[];
  hr_score?: number[];
  test_email_sent?: boolean;
}

export const useJobCandidatesList = (
  jobId: string | null | undefined,
  jdVersion: number | undefined,
  skip: number = 0,
  limit: number = 10,
  filters?: CandidateFilters
) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.JOBS.CANDIDATES, jobId, jdVersion, skip, limit, filters],
    queryFn: () =>
      jobService.getJobCandidates(
        jobId!,
        jdVersion,
        skip,
        limit,
        undefined,
        undefined,
        filters
      ),
    enabled: !!jobId,
    placeholderData: keepPreviousData,
    staleTime: QUERY_CONFIG.JOB_CANDIDATES_LIST.staleTime,
    refetchInterval: (query) => {
      const candidates = query.state.data?.data;
      if (Array.isArray(candidates)) {
        const isAnyProcessing = candidates.some(
          (c) => c.processing_status === "processing" || !c.is_parsed
        );
        if (isAnyProcessing) {
          return 30000; // poll every 30s if any candidate is processing
        }
      }
      return false;
    },
  });

  return {
    data: res.data?.data ?? [],
    loading: res.isLoading,
    isRefreshing: res.isFetching && !res.isLoading,
    error: res.error,
    refetch: res.refetch,
    total: res.data?.total ?? 0,
  };
};
