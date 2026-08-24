import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminDesignationService } from "@/apis/designation";
import type { DesignationCreate, DesignationUpdate } from "@/types/designation";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for creating a designation.
 */
export function useCreateDesignationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DesignationCreate) => adminDesignationService.createDesignation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.DESIGNATIONS] });
    },
  });
}

/**
 * Hook for updating a designation.
 */
export function useUpdateDesignationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DesignationUpdate }) =>
      adminDesignationService.updateDesignation({ id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.DESIGNATIONS] });
    },
  });
}

/**
 * Hook for deleting a designation.
 */
export function useDeleteDesignationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDesignationService.deleteDesignation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.DESIGNATIONS] });
    },
  });
}
