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

        onMutate: async ({ jobId }) => {
            // Cancel any in-flight fetches for data we are about to invalidate
            await queryClient.cancelQueries({
                queryKey: [QUERY_KEYS.JOBS.CANDIDATES, jobId],
            });
            await queryClient.cancelQueries({
                queryKey: [QUERY_KEYS.JOBS.STATS, jobId],
            });
            await queryClient.cancelQueries({
                queryKey: [QUERY_KEYS.JOBS.DETAIL, jobId],
            });
        },

        onSettled: (_data, _error, variables) => {
            const jobId = variables.jobId;

            // Invalidate queries and refetch all data individually
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.JOBS.CANDIDATES, jobId],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.JOBS.STATS, jobId],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.JOBS.DETAIL, jobId],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.ADMIN.DASHBOARD_DATA],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.ADMIN.LOCATIONS],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.ADMIN.AUDIT_LOGS],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.ADMIN.RECENT_UPLOADS],
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

        onMutate: async ({ jobId }) => {
            await queryClient.cancelQueries({
                queryKey: [QUERY_KEYS.JOBS.CANDIDATES, jobId],
            });
            await queryClient.cancelQueries({
                queryKey: [QUERY_KEYS.JOBS.STATS, jobId],
            });
            await queryClient.cancelQueries({
                queryKey: [QUERY_KEYS.JOBS.DETAIL, jobId],
            });
        },

        onSettled: (_data, _error, variables) => {
            const jobId = variables.jobId;

            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.JOBS.CANDIDATES, jobId],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.JOBS.STATS, jobId],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.JOBS.DETAIL, jobId],
            });
        },
    });
}