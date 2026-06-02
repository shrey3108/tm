import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminStageTemplateService } from "@/apis/admin";
import type { StageTemplateCreate, StageTemplateUpdate } from "@/types/admin";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for creating a stage template.
 */
export function useCreateStageTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StageTemplateCreate) => adminStageTemplateService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.STAGES] });
    },
  });
}

/**
 * Hook for updating an existing stage template.
 */
export function useUpdateStageTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StageTemplateUpdate }) =>
      adminStageTemplateService.updateTemplate(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ADMIN.STAGES] });

      // previous result
      const previousStagesQueries = queryClient.getQueriesData({ queryKey: [QUERY_KEYS.ADMIN.STAGES] });

      // Optimistically update the matching queries
      queryClient.setQueriesData(
        { queryKey: [QUERY_KEYS.ADMIN.STAGES] },
        (old: any) => {
          if (!old) return old;
          if (old.data && Array.isArray(old.data)) {
            return {
              ...old,
              data: old.data.map((template: any) =>
                template.id === id ? { ...template, ...data } : template
              ),
            };
          }
          if (Array.isArray(old)) {
            return old.map((template: any) =>
              template.id === id ? { ...template, ...data } : template
            );
          }
          return old;
        }
      );

      // Return a context object with the snapshotted value
      return { previousStagesQueries };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousStagesQueries) {
        context.previousStagesQueries.forEach(([queryKey, queryData]) => {
          queryClient.setQueryData(queryKey, queryData);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.STAGES] });
    },
  });
}

/**
 * Hook for deleting a stage template.
 */
export function useDeleteStageTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminStageTemplateService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.STAGES] });
    },
  });
}
