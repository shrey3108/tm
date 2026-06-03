import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";
import jobService from "@/apis/job";
import { jobStageService } from "@/apis/jobStage";
import { candidateStageService } from "@/apis/candidateStage";
import { transcriptService } from "@/apis/transcript";
import { candidateDecisionApi } from "@/apis/candidateDecision";
import { adminCandidateService } from "@/apis/admin/candidate";
import { slugify, unSlugify } from "@/utils/slug";
import { useJob, useJobTitle } from "@/hooks/queries/jobs";
import type { Job } from "@/types/job";
import type { CandidateAnalysis } from "@/types/admin";

/**
 * Hook to resolve Job and Candidate from URL slugs if state is not available.
 * Supports fallback to location.state if provided.
 */
export function useResolvedJobAndCandidate(
  jobSlug: string | undefined,
  candidateNameSlug: string | undefined,
  stateJob?: Job | null,
  stateCandidate?: CandidateAnalysis | null
) {
  const searchJobTitle = jobSlug ? unSlugify(jobSlug) : "";

  // 1. Fetch job list matching the unslugified name if job is not in state
  const jobTitleQuery = useJobTitle(searchJobTitle, !!jobSlug && !stateJob);

  // Determine the resolved jobId
  const resolvedJobId = stateJob?.id || (() => {
    if (!jobTitleQuery.data || jobTitleQuery.data.length === 0) return null;
    const found = jobTitleQuery.data.find((j) => slugify(j.title) === jobSlug);
    return found ? found.id : null;
  })();

  // Fetch full job details once we have resolvedJobId
  const jobDetailsQuery = useJob(resolvedJobId);

  const resolvedJob = jobDetailsQuery.data || stateJob || undefined;

  // 2. Fetch candidate search matching the unslugified name if candidate is not in state
  const candidateName = candidateNameSlug ? unSlugify(candidateNameSlug) : "";
  const candidateSearchQuery = useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.SEARCH, resolvedJob?.id, candidateNameSlug],
    queryFn: async () => {
      const response = await jobService.getJobCandidates(
        resolvedJob!.id,
        undefined,
        0,
        100, // Fetch first 100 candidates to find the exact match
        undefined,
        undefined,
        { query: candidateName }
      );
      const found = response.data.find(
        (c) => slugify(`${c.first_name} ${c.last_name}`) === candidateNameSlug
      );
      if (!found) {
        throw new Error("Candidate not found");
      }
      return found;
    },
    enabled: !!resolvedJob?.id && !!candidateNameSlug && !stateCandidate,
    staleTime: QUERY_CONFIG.CANDIDATE_STAGES.staleTime,
  });

  const resolvedCandidate = candidateSearchQuery.data || stateCandidate;

  return {
    job: resolvedJob,
    candidate: resolvedCandidate,
    isLoading:
      (!stateJob && jobTitleQuery.loading) ||
      (!!resolvedJobId && jobDetailsQuery.loading) ||
      (!stateCandidate && !!resolvedJob?.id && candidateSearchQuery.isLoading),
    error: jobTitleQuery.error || jobDetailsQuery.error || candidateSearchQuery.error,
  };
}

/**
 * Hook to query job stages list.
 */
export function useJobStagesQuery(jobId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.JOB_STAGES, jobId],
    queryFn: () => jobStageService.getJobStages(jobId!),
    enabled: !!jobId,
    staleTime: QUERY_CONFIG.CANDIDATE_STAGES.staleTime,
  });
}

/**
 * Hook to query AI evaluation details. Supports polling via refetchInterval.
 */
export function useCandidateEvaluationQuery(
  instanceId: string | null | undefined,
  isPolling: boolean
) {
  return useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION, instanceId],
    queryFn: () => candidateStageService.getEvaluation(instanceId!),
    enabled: !!instanceId,
    staleTime: QUERY_CONFIG.CANDIDATE_STAGES.staleTime,
    refetchInterval: isPolling ? 5000 : false,
  });
}

/**
 * Hook to query evaluation history versions.
 */
export function useCandidateEvaluationHistoryQuery(instanceId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION_HISTORY, instanceId],
    queryFn: () => candidateStageService.getEvaluationHistory(instanceId!),
    enabled: !!instanceId,
    staleTime: QUERY_CONFIG.CANDIDATE_STAGES.staleTime,
  });
}

/**
 * Hook to query transcript history.
 */
export function useCandidateTranscriptsQuery(candidateId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.TRANSCRIPTS, candidateId],
    queryFn: () => transcriptService.getCandidateTranscripts(candidateId!),
    enabled: !!candidateId,
    staleTime: QUERY_CONFIG.CANDIDATE_STAGES.staleTime,
  });
}

/**
 * Hook to query HR decision history.
 */
export function useHrDecisionHistoryQuery(
  candidateId: string | null | undefined,
  jobId: string | null | undefined,
  stageConfigId: string | null | undefined
) {
  return useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.HR_DECISION_HISTORY, candidateId, jobId, stageConfigId],
    queryFn: () =>
      candidateDecisionApi.getDecisionHistory(
        candidateId!,
        jobId || undefined,
        stageConfigId || undefined
      ),
    enabled: !!candidateId,
    staleTime: QUERY_CONFIG.CANDIDATE_STAGES.staleTime,
  });
}

/**
 * Hook to query candidate analysis details.
 */
export function useCandidateDetailsQuery(
  jobId: string | null | undefined,
  candidateId: string | null | undefined
) {
  return useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.DETAILS, jobId, candidateId],
    queryFn: async () => {
      const response = await jobService.getJobCandidates(jobId!, undefined, 0, 1, candidateId!);
      return response.data?.[0] ?? null;
    },
    enabled: !!jobId && !!candidateId,
    staleTime: QUERY_CONFIG.CANDIDATE_STAGES.staleTime,
  });
}

/**
 * Hook to query hiring journey timeline.
 */
export function useCandidateTimelineQuery(
  candidateId: string | null | undefined,
  jobId: string | undefined
) {
  return useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE, candidateId, jobId],
    queryFn: () => adminCandidateService.getCandidateTimeline(candidateId!, jobId),
    enabled: !!candidateId,
    staleTime: QUERY_CONFIG.CANDIDATE_STAGES.staleTime,
  });
}



/**
 * Hook to query a single transcript details by ID.
 */
export function useTranscriptQuery(transcriptId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.TRANSCRIPT, transcriptId],
    queryFn: () => transcriptService.getTranscript(transcriptId!),
    enabled: !!transcriptId,
    staleTime: QUERY_CONFIG.CANDIDATE_TRANSCRIPT.staleTime,
  });
}

// export const useTranscript = useTranscriptQuery;
// export const useTranscribe = useTranscriptQuery;

