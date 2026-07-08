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
      adminGuidelineService.updateGuideline({ id, data }),
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ADMIN.GUIDELINES] });

      // Snapshot the previous value
      const previousGuidelinesQueries = queryClient.getQueriesData({ queryKey: [QUERY_KEYS.ADMIN.GUIDELINES] });

      // Optimistically update to the new value
      queryClient.setQueriesData(
        { queryKey: [QUERY_KEYS.ADMIN.GUIDELINES] },
        (old: any) => {
          if (!old) return old;
          if (old.data && Array.isArray(old.data)) {
            return {
              ...old,
              data: old.data.map((guideline: any) =>
                guideline.id === id ? { ...guideline, ...data } : guideline
              ),
            };
          }
          if (Array.isArray(old)) {
            return old.map((guideline: any) =>
              guideline.id === id ? { ...guideline, ...data } : guideline
            );
          }
          return old;
        }
      );

      // Return a context object with the snapshotted value
      return { previousGuidelinesQueries };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousGuidelinesQueries) {
        context.previousGuidelinesQueries.forEach(([queryKey, queryData]) => {
          queryClient.setQueryData(queryKey, queryData);
        });
      }
    },
    onSettled: (_, __, variables) => {
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
