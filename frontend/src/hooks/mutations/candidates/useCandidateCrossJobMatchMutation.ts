import { useMutation, useQueryClient } from "@tanstack/react-query";
import { crossMatchApi } from "@/apis/crossMatch";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Mutation hook to trigger background cross-job matching.
 */
export function useTriggerCrossMatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resumeId: string) => crossMatchApi.triggerCrossMatch(resumeId),
    onSuccess: (_, resumeId) => {
      // Invalidate the cross job matches query to refresh the list
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.CROSS_JOB_MATCH, resumeId],
      });
    },
  });
}
