import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminGuidelineService } from "@/apis/admin";
import type { GuidelineCreate, GuidelineUpdate } from "@/types/guideline";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for creating a guideline.
 */
export function useCreateGuidelineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GuidelineCreate) => adminGuidelineService.createGuideline(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.GUIDELINES] });
    },
  });
}

/**
 * Hook for updating an existing guideline.
 */
export function useUpdateGuidelineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: GuidelineUpdate }) =>
      adminGuidelineService.updateGuideline(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.GUIDELINES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.GUIDELINE_DETAIL, variables.id] });
    },
  });
}

/**
 * Hook for deleting a guideline.
 */
export function useDeleteGuidelineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminGuidelineService.deleteGuideline(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.GUIDELINES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.GUIDELINE_DETAIL, id] });
    },
  });
}
