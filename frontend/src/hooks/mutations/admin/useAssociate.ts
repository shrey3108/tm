import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAssociateService } from "@/apis/admin";
import type { AssociateCreate, AssociateUpdate } from "@/types/associate";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for creating an associate.
 */
export function useCreateAssociateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssociateCreate) => adminAssociateService.createAssociate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.ASSOCIATES] });
    },
  });
}

/**
 * Hook for updating an existing associate.
 */
export function useUpdateAssociateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssociateUpdate }) =>
      adminAssociateService.updateAssociate({ id, data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.ASSOCIATES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.ASSOCIATE_DETAIL, variables.id] });
    },
  });
}

/**
 * Hook for deleting an associate.
 */
export function useDeleteAssociateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminAssociateService.deleteAssociate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.ASSOCIATES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.ASSOCIATE_DETAIL, id] });
    },
  });
}
