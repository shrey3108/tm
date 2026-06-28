import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminCriteriaService } from "@/apis/admin";
import type { CriterionCreate, CriterionUpdate } from "@/types/jobCriteria";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for creating a criterion.
 */
export function useCreateCriterionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CriterionCreate) => adminCriteriaService.createCriterion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.CRITERIA] });
    },
  });
}

/**
 * Hook for updating an existing criterion.
 */
export function useUpdateCriterionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CriterionUpdate }) =>
      adminCriteriaService.updateCriterion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.CRITERIA] });
    },
  });
}

/**
 * Hook for deleting a criterion.
 */
export function useDeleteCriterionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminCriteriaService.deleteCriterion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.CRITERIA] });
    },
  });
}

/**
 * Hook for enhancing a criterion prompt.
 */
export function useEnhanceCriterionPromptMutation() {
  return useMutation({
    mutationFn: (data: { name: string, description: string }) => adminCriteriaService.enhanceCriterionPrompt(data),
  });
}
