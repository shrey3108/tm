import { useMutation, useQueryClient } from "@tanstack/react-query";
import { candidateDecisionApi } from "@/apis/candidateDecision";
import { taskService } from "@/apis/task";
import { candidateStageService } from "@/apis/candidateStage";
import type { CandidateDecisionFormValues } from "@/schemas/candidate";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Mutation hook to submit HR decisions.
 */
export function useSubmitDecisionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      candidate_id: string;
      decision: CandidateDecisionFormValues["decision"];
      note?: string;
      stage_config_id?: string;
      job_id?: string;
      score: number;
    }) => candidateDecisionApi.submitDecision(data),
    onSuccess: (_, variables) => {
      // Invalidate HR decisions for this candidate
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.HR_DECISION_HISTORY, variables.candidate_id],
      });
      // Invalidate timeline queries
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE, variables.candidate_id],
      });
    },
  });
}

/**
 * Mutation hook to upload candidate-specific task.
 */
export function useUploadCandidateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateId, file }: { candidateId: string; file: File }) =>
      taskService.uploadCandidateTask(candidateId, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.DETAILS],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE, variables.candidateId],
      });
    },
  });
}

/**
 * Mutation hook to trigger background GitHub evaluation.
 */
export function useEvaluateGithubMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, githubUrl }: { stageId: string; githubUrl: string }) =>
      candidateStageService.evaluateGithub(stageId, githubUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION_HISTORY],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.JOBS.CANDIDATES],
      });
    },
  });
}
