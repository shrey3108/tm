import { transcriptService } from "@/apis/transcript";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * Hook to fetch the default transcript path.
 */
export function useDefaultTranscriptPathQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [QUERY_KEYS.ADMIN.DASHBOARD_DATA, "transcript-default-path"],
    queryFn: () => transcriptService.getDefaultTranscriptPath(),
    staleTime: QUERY_CONFIG.TRANSCRIPT_PATH.staleTime,
    ...options,
  });
}
