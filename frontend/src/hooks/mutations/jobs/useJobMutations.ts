import { useMutation, useQueryClient } from "@tanstack/react-query";
import jobService from "@/apis/job";
import { adminJobService } from "@/apis/admin/job";
import { jobStageService } from "@/apis/jobStage";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { useAppDispatch } from "@/store/hooks";
import { startPolling } from "@/store/slices/pollingSlice";

/**
 * Hook for creating a new job posting.
 */
export function useCreateJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => jobService.createJob(data),
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOBS.LIST] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOBS.ADMIN_LIST] });
      }, 1000)
    },
  });
}

/**
 * Hook for updating an existing job posting.
 */
export function useUpdateJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, data }: { jobId: string; data: Record<string, any> }) =>
      jobService.updateJob(jobId, data),
    onMutate: async ({ jobId, data }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.JOBS.LIST] });
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.JOBS.ADMIN_LIST] });
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.JOBS.DETAIL, jobId] });

      // Snapshot the previous values
      const previousJobsQueries = queryClient.getQueriesData({ queryKey: [QUERY_KEYS.JOBS.LIST] });
      const previousAdminJobsQueries = queryClient.getQueriesData({ queryKey: [QUERY_KEYS.JOBS.ADMIN_LIST] });
      const previousJobDetail = queryClient.getQueryData([QUERY_KEYS.JOBS.DETAIL, jobId]);

      // Optimistically update the detail query if it exists
      if (previousJobDetail) {
        queryClient.setQueryData(
          [QUERY_KEYS.JOBS.DETAIL, jobId],
          (old: any) => ({ ...old, ...data })
        );
      }

      // Optimistically update the list query caches
      queryClient.setQueriesData(
        { queryKey: [QUERY_KEYS.JOBS.LIST] },
        (old: any) => {
          if (!old) return old;
          if (old.data && Array.isArray(old.data)) {
            return {
              ...old,
              data: old.data.map((job: any) =>
                job.id === jobId ? { ...job, ...data } : job
              ),
            };
          }
          if (Array.isArray(old)) {
            return old.map((job: any) =>
              job.id === jobId ? { ...job, ...data } : job
            );
          }
          return old;
        }
      );

      queryClient.setQueriesData(
        { queryKey: [QUERY_KEYS.JOBS.ADMIN_LIST] },
        (old: any) => {
          if (!old) return old;
          if (old.data && Array.isArray(old.data)) {
            return {
              ...old,
              data: old.data.map((job: any) =>
                job.id === jobId ? { ...job, ...data } : job
              ),
            };
          }
          if (Array.isArray(old)) {
            return old.map((job: any) =>
              job.id === jobId ? { ...job, ...data } : job
            );
          }
          return old;
        }
      );

      return { previousJobsQueries, previousAdminJobsQueries, previousJobDetail };
    },
    onError: (_err, { jobId }, context) => {
      // Rollback on error
      if (context) {
        if (context.previousJobsQueries) {
          context.previousJobsQueries.forEach(([queryKey, queryData]) => {
            queryClient.setQueryData(queryKey, queryData);
          });
        }
        if (context.previousAdminJobsQueries) {
          context.previousAdminJobsQueries.forEach(([queryKey, queryData]) => {
            queryClient.setQueryData(queryKey, queryData);
          });
        }
        if (context.previousJobDetail !== undefined) {
          queryClient.setQueryData([QUERY_KEYS.JOBS.DETAIL, jobId], context.previousJobDetail);
        }
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOBS.LIST] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOBS.ADMIN_LIST] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOBS.DETAIL, variables.jobId] });
    },
  });
}

/**
 * Hook for deleting a job posting.
 */
export function useDeleteJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => jobService.deleteJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOBS.LIST] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOBS.ADMIN_LIST] });
    },
  });
}

/**
 * Hook for adding a stage template to a job.
 */
export function useAddStageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      jobId,
      templateId,
      stageOrder,
    }: {
      jobId: string;
      templateId: string;
      stageOrder: number;
    }) =>
      adminJobService.addStageToJob(jobId, {
        template_id: templateId,
        stage_order: stageOrder,
        is_mandatory: true,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.JOB_STAGES, variables.jobId],
      });
    },
  });
}

/**
 * Hook for removing a stage config from a job.
 */
export function useRemoveStageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, configId }: { jobId: string; configId: string }) =>
      adminJobService.removeStageFromJob(jobId, configId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.JOB_STAGES, variables.jobId],
      });
    },
  });
}

/**
 * Hook for setting up default stages for a job.
 */
export function useSetupDefaultStagesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => jobStageService.setupDefaultStages(jobId),
    onSuccess: (_data, jobId) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.JOB_STAGES, jobId],
      });
    },
  });
}

/**
 * Hook for reordering stages in a job.
 */
export function useReorderStagesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, stageIds }: { jobId: string; stageIds: string[] }) =>
      adminJobService.reorderJobStages(jobId, { stage_ids: stageIds }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CANDIDATES.JOB_STAGES, variables.jobId],
      });
    },
  });
}



/**
 * Hook for reanalyzing a candidate for a job.
 */
export function useReanalyzeCandidateMutation() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: ({ jobId, candidateId }: { jobId: string; candidateId: string; candidateName?: string; jobTitle?: string }) =>
      jobService.reanalyzeCandidate(jobId, candidateId),
    onSuccess: (_data, variables) => {
      dispatch(
        startPolling({
          type: "resume",
          stageId: variables.candidateId,
          candidateId: variables.candidateId,
          jobId: variables.jobId,
          candidateName: variables.candidateName || "Candidate",
          stageName: "Re-analysis",
          jobTitle: variables.jobTitle || "",
        })
      );
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
