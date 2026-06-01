import { useMutation, useQueryClient } from "@tanstack/react-query";
import { candidateDecisionApi } from "@/apis/candidateDecision";
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
