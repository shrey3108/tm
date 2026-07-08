import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminUserService } from "@/apis/admin";
import type { UserAdminCreate, UserAdminUpdate } from "@/types/permission-role";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for creating a user.
 */
export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserAdminCreate) => adminUserService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.USERS] });
    },
  });
}

/**
 * Hook for updating an existing user.
 */
export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserAdminUpdate }) =>
      adminUserService.updateUser({ id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.USERS] });
    },
  });
}

/**
 * Hook for deleting a user.
 */
export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminUserService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.USERS] });
    },
  });
}
