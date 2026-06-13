import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "@/apis/task";
import { QUERY_KEYS } from "@/constants/queryKeys";
import type {
  CandidateTestPaperAssign,
  CandidateTestPaperEmailSend,
  CandidateTestPaperBulkEmailSend,
} from "@/types/taskPaper";

/**
 * Hook to upload a new predefined question set paper template.
 */
export function useUploadQuestionSetPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      jobId,
      positionId,
      file,
    }: {
      jobId: string;
      positionId: string;
      file: File;
    }) => taskService.uploadQuestionSetPaper({ jobId, positionId, file }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
      });
    },
  });
}

/**
 * Hook to delete a predefined question set paper template.
 */
export function useDeleteQuestionSetPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paperId: string) => taskService.deleteQuestionSetPaper(paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
      });
    },
  });
}

/**
 * Hook to assign/generate/customize a test paper for a candidate.
 */
export function useAssignTestPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CandidateTestPaperAssign) =>
      taskService.assignTestPaperToCandidate(data),
    onSuccess: (data) => {
      // Set query data immediately to update UI without delay
      queryClient.setQueryData(
        [QUERY_KEYS.TASK_PAPERS.ASSIGNED, data.candidate_id],
        data
      );
      // Invalidate queries for the specific candidate using the returned ID
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ASSIGNED, data.candidate_id],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.TASK_METADATA, data.candidate_id],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.SKILLS, data.candidate_id],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.JOBS.CANDIDATES],
      });
    },
  });
}

/**
 * Hook to unassign/remove the test paper from the candidate's profile.
 */
export function useDeleteCandidateTestPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateId: string) =>
      taskService.deleteCandidateTestPaper(candidateId),
    onSuccess: (_data, candidateId) => {
      // Set query data to null immediately
      queryClient.setQueryData(
        [QUERY_KEYS.TASK_PAPERS.ASSIGNED, candidateId],
        null
      );
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ASSIGNED, candidateId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.TASK_METADATA, candidateId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.SKILLS, candidateId],
      });
    },
  });
}

/**
 * Hook to delete the default common test paper assigned to the job.
 */
export function useDeleteJobDefaultTestPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      taskService.deleteJobDefaultTestPaper(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ASSIGNED],
      });
    },
  });
}

/**
 * Hook to trigger sending the notification email with assigned test details to the candidate.
 */
export function useSendTestPaperEmailMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CandidateTestPaperEmailSend) =>
      taskService.sendTestPaperEmail(data),
    // invalidate 
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ASSIGNED],
      });
    },
  });
}

/**
 * Hook to trigger sending the notification email with assigned test details in bulk.
 */
export function useSendBulkTestPaperEmailMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CandidateTestPaperBulkEmailSend) =>
      taskService.sendBulkTestPaperEmail(data),
    // invalidate 
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ASSIGNED],
      });
    },
  });
}
