import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminSystemService } from "@/apis/admin/admin-system";

/**
 * Hook for clearing the system cache.
 */
export function useClearCacheMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (keys?: string[]) => {
      if (!keys || keys.length === 0) {
        // Clear everything if nothing selected
        const res = await adminSystemService.clearCache();
        return res;
      } else {
        // Clear selected keys in parallel
        return await Promise.allSettled(
          keys.map((key) => adminSystemService.clearCache(key))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(); // invalidate all cached data
    },
  });
}
