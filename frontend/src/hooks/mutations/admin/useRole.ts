import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminRoleService, adminPermissionService } from "@/apis/admin";
import type { RoleCreate, RoleUpdate } from "@/types/permission-role";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for creating a role.
 */
export function useCreateRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoleCreate) => adminRoleService.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.ROLES] });
    },
  });
}

/**
 * Hook for updating an existing role.
 */
export function useUpdateRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RoleUpdate }) =>
      adminRoleService.updateRole({ id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.ROLES] });
    },
  });
}

/**
 * Hook for deleting a role.
 */
export function useDeleteRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminRoleService.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.ROLES] });
    },
  });
}

/**
 * Hook for deleting a permission.
 * Bundled with roles since permissions are closely coupled to roles in the UI.
 */
export function useDeletePermissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminPermissionService.deletePermission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.ROLES] });
    },
  });
}
