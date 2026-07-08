import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminCandidateService } from "@/apis/admin";
import { resumeService } from "@/apis/resume";
import type { LoaderFunctionArgs } from "react-router-dom";
import type { CandidateResponse } from "@/types/resume";

export const adminCandidateSearchLoader = async ({ params }: LoaderFunctionArgs) => {
  const jobId = params.jobId;
  const skip = 0;
  const limit = 10;
  const filters = {
    status: [],
    city: [],
    job: [],
    hr_decision: [],
    pageIndex: 0,
    pageSize: 10,
    q: "",
  };

  await queryClient.fetchQuery({
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
  });

  return null;
};
