import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminJobPositionService } from "@/apis/admin";
import type {
  JobPositionCreate,
  JobPositionUpdate,
} from "@/types/jobPosition";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for creating a job position.
 */
export function useCreatePositionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: JobPositionCreate) => adminJobPositionService.createPosition(data),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.POSITIONS] });
    },
  });
}

/**
 * Hook for updating an existing job position.
 */
export function useUpdatePositionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: JobPositionUpdate }) =>
      adminJobPositionService.updatePosition({ id, data }),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.POSITIONS] });
    },
  });
}

/**
 * Hook for deleting a job position.
 */
export function useDeletePositionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminJobPositionService.deletePosition(id),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.POSITIONS] });
    },
  });
}
