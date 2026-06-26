import { useQuery } from "@tanstack/react-query";
import { taskService } from "@/apis/task";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * Hook for retrieving the task configuration (PDF path and extracted skills) for a job.
 * @param jobId - The UUID of the job
 */
export const useJobTask = (jobId: string | null | undefined) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.JOBS.TASK, jobId],
    queryFn: () => taskService.getJobTask(jobId!),
    enabled: !!jobId,
    staleTime: QUERY_CONFIG.JOB_DETAIL.staleTime,
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};

export const useDownloadCandidateTask = (candidateId: string | null | undefined) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.JOBS.TASK_DOWNLOAD, candidateId],
    queryFn: () => taskService.downloadCandidateTask(candidateId!),
    enabled: !!candidateId,
    staleTime: QUERY_CONFIG.JOB_DETAIL.staleTime,
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};

export const useDownloadJobTask = (jobId: string | null | undefined) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.JOBS.TASK_DOWNLOAD, jobId],
    queryFn: () => taskService.downloadJobTask(jobId!),
    enabled: !!jobId,
    staleTime: QUERY_CONFIG.JOB_DETAIL.staleTime,
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};



/**
 * Hook for retrieving the assigned task for a job.
 * @param jobId - The UUID of the job
 */
export const useJobAssignedTask = (
  jobId: string | null | undefined,
  jobStageId?: string
) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.JOBS.TASK_ASSIGNED, jobId, jobStageId],
    queryFn: () => taskService.getJobAssignedTask(jobId!, jobStageId),
    enabled: !!jobId,
    staleTime: QUERY_CONFIG.JOB_DETAIL.staleTime,
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};