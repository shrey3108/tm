import { transcriptService } from "@/apis/transcript";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook for uploading transcripts for a candidate stage.
 */
export function useUploadTranscriptMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ stageId, files }: { stageId: string; files: File[] }) =>
            transcriptService.uploadTranscript(stageId, files),
        onSuccess: (_data, _variables) => {
            // Invalidate candidate transcripts
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.CANDIDATES.TRANSCRIPTS],
            });
            // Invalidate candidate evaluation
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION],
            });
            // Invalidate timeline
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE],
            });
            // Also invalidate candidate list just in case stage status changed
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.JOBS.CANDIDATES],
            });
        },
    });
}

/**
 * Hook for updating default transcript path.
 */
export function useUpdateDefaultTranscriptPathMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (path: string) => transcriptService.updateDefaultTranscriptPath(path),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.ADMIN.DASHBOARD_DATA, "transcript-default-path"],
            });
        },
    });
}