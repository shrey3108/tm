import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminSystemService } from "@/apis/admin/admin-system";

/**
 * Hook for clearing the system cache.
 */
export function useClearCacheMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (keys?: string[]) => {
      // Pass the pattern list directly to clearCache (or undefined if empty/none selected)
      return await adminSystemService.clearCache(keys && keys.length > 0 ? keys : undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(); // invalidate all cached data
    },
  });
}
