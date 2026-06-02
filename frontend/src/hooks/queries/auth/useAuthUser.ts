import { authService } from "@/apis/auth";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch the currently authenticated user's profile.
 */
export function useAuthUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authService.getMe(),
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: false,
  });
}
