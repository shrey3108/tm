import { authService } from "@/apis/auth";
import { useQuery } from "@tanstack/react-query";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * Hook to fetch the currently authenticated user's profile.
 */
export function useAuthUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authService.getMe(),
    staleTime: QUERY_CONFIG.AUTH_USER.staleTime,
    retry: false,
  });
}
