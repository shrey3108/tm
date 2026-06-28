import { adminPermissionService } from "@/apis/admin";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import type { PermissionCreate } from "@/types/permission-role";

/**
 * Hook for creating a new permission.
 */
export function useCreatePermissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PermissionCreate) => adminPermissionService.createPermission(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.ADMIN.PERMISSIONS],
      });
    },
  });
}
