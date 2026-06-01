import jobService from "@/apis/job";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

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
}

export const useJobCandidatesList = (
  jobId: string | null | undefined,
  jdVersion: number | undefined,
  skip: number,
  limit: number,
  filters?: CandidateFilters
) => {
  const res = useQuery({
    queryKey: ["jobCandidates", jobId, jdVersion, skip, limit, filters],
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
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: (query) => {
      const candidates = query.state.data?.data;
      if (Array.isArray(candidates)) {
        const isAnyProcessing = candidates.some(
          (c) => c.processing_status === "processing" || !c.is_parsed
        );
        if (isAnyProcessing) {
          return 5000; // poll every 5s if any candidate is processing
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
