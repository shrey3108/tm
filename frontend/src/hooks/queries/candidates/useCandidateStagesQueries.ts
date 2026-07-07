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
import { useJob, useJobTitle } from "@/hooks/queries/jobs/useJob";
import type { Job } from "@/types/job";
import type { CandidateAnalysis } from "@/types/admin";


interface UseResolvedJobAndCandidate {
  jobSlug: string | undefined,
  candidateNameSlug: string | undefined,
  stateJob?: Job | null,
  stateCandidate?: CandidateAnalysis | null,
  stateCandidateId?: string | null
}

/**
 * Hook to resolve Job and Candidate from URL slugs if state is not available.
 * Supports fallback to location.state if provided.
 */
export function useResolvedJobAndCandidate(
  { jobSlug,
    candidateNameSlug,
    stateJob,
    stateCandidate,
    stateCandidateId }: UseResolvedJobAndCandidate) {
  // Validate stateJob against jobSlug to prevent using stale location state
  const isStateJobValid = !!(stateJob && jobSlug && slugify(stateJob.title) === jobSlug);
  const validatedStateJob = isStateJobValid ? stateJob : null;

  const searchJobTitle = jobSlug ? unSlugify(jobSlug) : "";

  // 1. Fetch job list matching the unslugified name if job is not in state
  const jobTitleQuery = useJobTitle(searchJobTitle, !!jobSlug && !validatedStateJob);

  // Determine the resolved jobId
  const resolvedJobId = validatedStateJob?.id || (() => {
    if (!jobTitleQuery.data || jobTitleQuery.data.length === 0) return null;
    const found = jobTitleQuery.data.find((j) => slugify(j.title) === jobSlug);
    return found ? found.id : null;
  })();

  // Fetch full job details once we have resolvedJobId
  const jobDetailsQuery = useJob(resolvedJobId);

  const resolvedJob = jobDetailsQuery.data || validatedStateJob || undefined;

  // Validate stateCandidate against candidateNameSlug to prevent using stale location state
  const isStateCandidateValid = !!(stateCandidate && candidateNameSlug && slugify(`${stateCandidate.first_name} ${stateCandidate.last_name}`) === slugify(candidateNameSlug));
  const validatedStateCandidate = isStateCandidateValid ? stateCandidate : null;

  // Use the candidate ID from the full object if available, otherwise from the explicit ID parameter
  const effectiveCandidateId = validatedStateCandidate?.id || stateCandidateId || undefined;

  // 2. Fetch candidate search matching the unslugified name if candidate is not in state
  const candidateSearchQuery = useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.SEARCH, resolvedJob?.id, effectiveCandidateId, candidateNameSlug],
    queryFn: async () => {
      const response = await jobService.getJobCandidates(
        resolvedJob!.id,
        undefined,
        0,
        100, // Fetch first 100 candidates to find the exact match
        undefined,
        undefined,
        { candidate_id: effectiveCandidateId }
      );
      const found = response.data.find(
        (c) => slugify(`${c.first_name} ${c.last_name}`) === slugify(candidateNameSlug)
      );
      if (!found) {
        throw new Error("Candidate not found");
      }
      return found;
    },
    enabled: !!resolvedJob?.id && !!candidateNameSlug,
    staleTime: QUERY_CONFIG.CANDIDATE_STAGES.staleTime,
  });

  const resolvedCandidate = candidateSearchQuery.data || validatedStateCandidate;

  return {
    job: resolvedJob,
    candidate: resolvedCandidate,
    isLoading:
      (!validatedStateJob && jobTitleQuery.loading) ||
      (!!resolvedJobId && jobDetailsQuery.loading) ||
      (!validatedStateCandidate && !!resolvedJob?.id && candidateSearchQuery.isLoading),
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
    refetchInterval: isPolling ? 15000 : false,
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
export function useCandidateTranscriptsQuery(candidateId: string | null | undefined, transcriptId: string | null | undefined = null) {
  return useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.TRANSCRIPTS, candidateId, transcriptId],
    queryFn: () => transcriptService.getCandidateTranscripts(candidateId!),
    enabled: !!candidateId && !!transcriptId,
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

/**
 * Hook to query candidate stage similarity scores.
 */
export function useSimilarityScoresQuery(id: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.SIMILARITY_SCORES, id],
    queryFn: () => candidateStageService.getSimilarityScores(id!),
    enabled: !!id,
    staleTime: QUERY_CONFIG.CANDIDATE_STAGES.staleTime,
  });
}

/**
 * Hook to query all associate evaluation results for a candidate stage.
 */
export function useCandidateAssociateResultsQuery(id: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.ASSOCIATE_RESULTS, id],
    queryFn: () => candidateStageService.getAssociateResults(id!),
    enabled: !!id,
    staleTime: QUERY_CONFIG.CANDIDATE_STAGES.staleTime,
    retry: false,
  });
}

// export const useTranscript = useTranscriptQuery;
// export const useTranscribe = useTranscriptQuery;

