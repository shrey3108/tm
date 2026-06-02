import jobService from "@/apis/job";
import { resumeService } from "@/apis/resume";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook for uploading a resume for a job.
 */
export function useUploadResumeMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ jobId, file }: { jobId: string; file: File }) =>
            jobService.uploadResume(jobId, file),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.JOBS.CANDIDATES, variables.jobId],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.JOBS.STATS, variables.jobId],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.JOBS.DETAIL, variables.jobId],
            });
        },
    });
}

/**
 * Hook for deleting a resume/candidate for a job.
 */
export function useDeleteResumeMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ jobId, resumeId }: { jobId: string; resumeId: string }) =>
            resumeService.deleteResume(jobId, resumeId),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.JOBS.CANDIDATES, variables.jobId],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.JOBS.STATS, variables.jobId],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.JOBS.DETAIL, variables.jobId],
            });
        },
    });
}