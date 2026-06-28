import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminDepartmentService } from "@/apis/admin";
import type { DepartmentCreate, DepartmentUpdate } from "@/types/department";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for creating a department.
 */
export function useCreateDepartmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DepartmentCreate) => adminDepartmentService.createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.DEPARTMENTS] });
    },
  });
}

/**
 * Hook for updating an existing department.
 */
export function useUpdateDepartmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DepartmentUpdate }) =>
      adminDepartmentService.updateDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.DEPARTMENTS] });
    },
  });
}

/**
 * Hook for deleting a department.
 */
export function useDeleteDepartmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDepartmentService.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.DEPARTMENTS] });
    },
  });
}
