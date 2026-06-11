import jobService from "@/apis/job";
import { resumeService } from "@/apis/resume";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Shared query keys that both upload and delete mutations must invalidate
 * (job-scoped data that changes when a resume is added or removed).
 */
const jobScopedKeys = (jobId: string) => [
    [QUERY_KEYS.JOBS.CANDIDATES, jobId],
    [QUERY_KEYS.JOBS.STATS, jobId],
    [QUERY_KEYS.JOBS.DETAIL, jobId],
] as const;

/**
 * Additional global keys that only an upload needs to invalidate
 * (admin-wide aggregates / activity feeds).
 */
const globalUploadKeys = [
    [QUERY_KEYS.ADMIN.DASHBOARD_DATA],
    [QUERY_KEYS.ADMIN.LOCATIONS],
    [QUERY_KEYS.ADMIN.AUDIT_LOGS],
    [QUERY_KEYS.ADMIN.RECENT_UPLOADS],
] as const;

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
            await Promise.all(
                jobScopedKeys(jobId).map((key) =>
                    queryClient.cancelQueries({ queryKey: key }),
                ),
            );
        },

        onSettled: (_data, _error, variables) => {
            const keys = [
                ...jobScopedKeys(variables.jobId),
                ...globalUploadKeys,
            ];

            // invalidate queries and refetch all data
            Promise.all(
                keys.map((key) =>
                    queryClient.invalidateQueries({ queryKey: [...key] }),
                ),
            );
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
            await Promise.all(
                jobScopedKeys(jobId).map((key) =>
                    queryClient.cancelQueries({ queryKey: key }),
                ),
            );
        },

        onSettled: (_data, _error, variables) => {
            Promise.all(
                jobScopedKeys(variables.jobId).map((key) =>
                    queryClient.invalidateQueries({ queryKey: [...key] }),
                ),
            );
        },
    });
}