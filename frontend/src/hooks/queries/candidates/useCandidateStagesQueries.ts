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
        { candidate_id: stateCandidate?.id }
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
    // select: (data) => {
    //   return {
    //     ...data,
    //     current_stage: getCorrectCurrentStage(data)
    //   };
    // }
    /*
    // TODO: NOTE: Remove this after GEP complete
    select: (data) => {
      if (!data || !data.events) return data;

      // 1. Check if the candidate has been marked as failed by HR in any round
      const failKeywords = ["fail", "failed"];
      const hasFail = data.events.some((event) => {
        const decision = event.hr_decision?.toLowerCase() ?? "";
        return failKeywords.some((k) => decision.includes(k));
      }) || failKeywords.some((k) => (data.latest_decision?.toLowerCase() ?? "").includes(k));

      if (hasFail) {
        return {
          ...data,
          current_stage: getCorrectCurrentStage(data)
        };
      }

      // 2. Check if the candidate passed "HR Screening Round"
      const hrScreeningEvent = data.events.find(
        (event) => event.title?.toLowerCase() === "hr screening round"
      );
      const hrScreeningPassed = hrScreeningEvent && hrScreeningEvent.hr_decision === "pass"


      if (!hrScreeningPassed) {
        return {
          ...data,
          current_stage: getCorrectCurrentStage(data)
        };
      }

      // 3. Find the index of the "Technical Practical Round" or "Coding Test Round"
      const techIndex = data.events.findIndex(
        (event) => event.title === "Technical Practical Round" || event.title === "Coding Test Round"
      );

      if (techIndex === -1) {
        return {
          ...data,
          current_stage: getCorrectCurrentStage(data)
        };
      }

      // 4. Pass all stages till "Technical Practical Round"
      const updatedEvents = data.events.map((event, idx) => {
        if (idx <= techIndex) {
          return {
            ...event,
            result: "pass",
            ai_result: event.ai_result !== "pending" ? event.ai_result : "pass",
            hr_decision: "pass",
            score: event.score ?? 4,
            ai_score: event.ai_score ?? 4,
            hr_score: event.hr_score ?? 4,
            event_date: new Date()
          };
        }
        return event;
      });

      // 5. Update current_stage if the original current_stage is one of the auto-passed stages
      let updatedCurrentStage = data.current_stage;
      const currentStageIndex = data.events.findIndex(
        (event) => event.title === data.current_stage
      );
      if (currentStageIndex !== -1 && currentStageIndex <= techIndex) {
        // Find the first stage after the Technical Practical Round
        const nextStage = data.events[techIndex + 1];
        if (nextStage) {
          updatedCurrentStage = nextStage.title;
        }
      }

      return {
        ...data,
        events: updatedEvents,
        current_stage: updatedCurrentStage,
      };
    }
    */
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
  });
}

// export const useTranscript = useTranscriptQuery;
// export const useTranscribe = useTranscriptQuery;

