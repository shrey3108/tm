import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminJobPriorityService } from "@/apis/admin";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for creating a job priority.
 */
export function useCreatePriorityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { duration_days: number }) => adminJobPriorityService.createPriority(data),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.JOB_PRIORITIES] });
    },
  });
}

/**
 * Hook for updating an existing job priority.
 */
export function useUpdatePriorityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { duration_days?: number } }) =>
      adminJobPriorityService.updatePriority({ id, data }),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.JOB_PRIORITIES] });
    },
  });
}

/**
 * Hook for deleting a job priority.
 */
export function useDeletePriorityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminJobPriorityService.deletePriority(id),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.JOB_PRIORITIES] });
    },
  });
}
