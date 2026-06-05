import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "@/apis/task";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for uploading or updating a job task file.
 */
export function useUploadJobTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, file }: { jobId: string; file: File }) =>
      taskService.uploadJobTask(jobId, file),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.JOBS.TASK, variables.jobId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.JOBS.TASK_DOWNLOAD, variables.jobId],
      });
    },
  });
}

/**
 * Hook for deleting a job task configuration.
 */
export function useDeleteJobTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => taskService.deleteJobTask(jobId),
    onSuccess: (_data, jobId) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.JOBS.TASK, jobId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.JOBS.TASK_DOWNLOAD, jobId],
      });
    },
  });
}
