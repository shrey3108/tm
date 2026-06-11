import { adminCandidateService } from "@/apis/admin";
import { resumeService } from "@/apis/resume";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";
import type { CandidateActiveFilters } from "@/hooks/useCandidateTableFilters";
import type { CandidateResponse } from "@/types/resume";

export const useAdminCandidates = (
  jobId: string | undefined,
  skip: number = 0,
  limit: number = 10,
  filters: CandidateActiveFilters = { status: [], city: [], job: [], hr_decision: [] }
) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.JOBS.ADMIN_CANDIDATES, jobId, skip, limit, filters],
    queryFn: async () => {
      let result: { data: CandidateResponse[]; total: number } = {
        data: [],
        total: 0,
      };

      const currentSearchQuery = filters.q || undefined;

      if (jobId) {
        if (currentSearchQuery?.trim()) {
          result = await adminCandidateService.searchJobCandidates(
            jobId,
            currentSearchQuery,
            skip,
            limit,
            filters
          );
        } else {
          result = await adminCandidateService.getCandidatesForJob(
            jobId,
            skip,
            limit,
            filters
          );
        }

        try {
          const resumesData = await resumeService.getJobResumes(jobId);
          result.data = result.data.map((candidate) => {
            const resume = resumesData.resumes.find(
              (r) => r.candidate_id === candidate.id
            );
            return {
              ...candidate,
              resume_id: resume?.resume_id || candidate.resume_id,
            };
          });
        } catch (err) {
          console.error("Failed to fetch resume IDs for candidates:", err);
        }
      } else {
        result = await adminCandidateService.searchCandidates(
          currentSearchQuery?.trim() || undefined,
          skip,
          limit,
          filters
        );
      }

      return result;
    },
    placeholderData: keepPreviousData,
    staleTime: QUERY_CONFIG.ADMIN_CANDIDATES.staleTime,
  });

  return {
    data: res.data?.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
    total: res.data?.total ?? 0,
  };
};
