import { useMutation, useQueryClient } from "@tanstack/react-query";
import { candidateDecisionApi } from "@/apis/candidateDecision";
import { taskService } from "@/apis/task";
import { candidateStageService } from "@/apis/candidateStage";
import type { CandidateDecisionFormValues } from "@/schemas/candidate";
import { QUERY_KEYS } from "@/constants/queryKeys";
import type {
  StageOverrideCreate,
  StageDecisionCreate,
  SendToAssociatesRequest,
} from "@/schemas/candidateStage";

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
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.JOBS.CANDIDATES, variables.job_id],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.JOBS.STATS, variables.job_id],
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
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.TRANSCRIPTS, variables.candidateId],
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
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.DETAILS],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.SEARCH],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.TASK_METADATA],
      });
    },
  });
}

/**
 * Mutation hook to submit GitHub repository URL without triggering evaluation.
 */
export function useSubmitGithubMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, githubUrl }: { stageId: string; githubUrl: string }) =>
      candidateStageService.submitGithub(stageId, githubUrl),
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
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.DETAILS],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.SEARCH],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.TASK_METADATA],
      });
    },
  });
}

/**
 * Mutation hook to retry failed candidate stage evaluation.
 */
export function useRetryEvaluationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId }: { stageId: string }) =>
      candidateStageService.retryEvaluation(stageId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION, variables.stageId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION_HISTORY, variables.stageId],
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

/**
 * Mutation hook to delete results and reset a stage.
 */
export function useDeleteCandidateStageResultsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId }: { stageId: string }) =>
      candidateStageService.deleteResults(stageId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION, variables.stageId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION_HISTORY, variables.stageId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.JOBS.CANDIDATES],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.HR_DECISION_HISTORY],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.ASSOCIATE_RESULTS, variables.stageId],
      });
    },
  });
}

/**
 * Mutation hook to send a paper to associates.
 */
export function useSendToAssociatesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, payload }: { stageId: string; payload: SendToAssociatesRequest }) =>
      candidateStageService.sendToAssociates(stageId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION, variables.stageId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION_HISTORY, variables.stageId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.JOBS.CANDIDATES],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.HR_DECISION_HISTORY],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.ASSOCIATE_RESULTS, variables.stageId],
      });
    },
  });
}

/**
 * Mutation hook to override AI evaluation.
 */
export function useOverrideEvaluationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, override }: { stageId: string; override: StageOverrideCreate }) =>
      candidateStageService.overrideEvaluation(stageId, override),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION, variables.stageId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION_HISTORY, variables.stageId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.JOBS.CANDIDATES],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.HR_DECISION_HISTORY],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.ASSOCIATE_RESULTS, variables.stageId],
      });
    },
  });
}

/**
 * Mutation hook to record HR stage decision.
 */
export function useRecordCandidateStageDecisionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, decision }: { stageId: string; decision: StageDecisionCreate }) =>
      candidateStageService.recordDecision(stageId, decision),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION, variables.stageId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION_HISTORY, variables.stageId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.JOBS.CANDIDATES],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.HR_DECISION_HISTORY],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.ASSOCIATE_RESULTS, variables.stageId],
      });
    },
  });
}
