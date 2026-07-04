import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "@/apis/task";
import { QUERY_KEYS } from "@/constants/queryKeys";
import type {
  CandidateTestPaperAssign,
  CandidateTestPaperEmailSend,
  CandidateTestPaperBulkEmailSend,
  QuestionSetPaperCreate,
  MCQItem,
  TaskItem,
  QuestionItem,
} from "@/types/taskPaper";

/**
 * Hook to upload a new predefined question set paper template.
 */
export function useUploadQuestionSetPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      departmentId,
      positionId,
      skillIds,
      paperType,
      file,
    }: {
      departmentId: string;
      positionId: string;
      skillIds: string[];
      paperType: "normal" | "mcq" | "task" | "mixed";
      file: File;
    }) => taskService.uploadQuestionSetPaper({ departmentId, positionId, skillIds, paperType, file }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
      });
    },
  });
}

/**
 * Hook to manually create a new predefined question set paper.
 */
export function useCreateQuestionSetPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: QuestionSetPaperCreate) =>
      taskService.createQuestionSetPaper(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
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
    onSuccess: (_data, paperId) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, paperId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
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
      if (data.candidate_id) {
        // Set query data immediately to update UI without delay
        queryClient.setQueryData(
          [QUERY_KEYS.TASK_PAPERS.ASSIGNED, data.candidate_id, data.job_stage_config_id],
          data
        );
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
      }

      if (data.job_id) {
        // Set job query data immediately
        queryClient.setQueryData(
          [QUERY_KEYS.JOBS.TASK_ASSIGNED, data.job_id, data.job_stage_config_id],
          data
        );
        queryClient.setQueryData(
          [QUERY_KEYS.JOBS.TASK_ASSIGNED, data.job_id],
          data
        );
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.JOBS.TASK_ASSIGNED, data.job_id],
        });
      }

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
    mutationFn: (param: string | { candidateId: string; jobStageId?: string }) => {
      const candidateId = typeof param === "string" ? param : param.candidateId;
      const jobStageId = typeof param === "string" ? undefined : param.jobStageId;
      return taskService.deleteCandidateTestPaper(candidateId, jobStageId);
    },
    onSuccess: (_data, param) => {
      const candidateId = typeof param === "string" ? param : param.candidateId;
      const jobStageId = typeof param === "string" ? undefined : param.jobStageId;
      // Set query data to null immediately
      queryClient.setQueryData(
        [QUERY_KEYS.TASK_PAPERS.ASSIGNED, candidateId, jobStageId],
        null
      );
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
    mutationFn: (param: string | { jobId: string; jobStageId?: string }) => {
      const jobId = typeof param === "string" ? param : param.jobId;
      const jobStageId = typeof param === "string" ? undefined : param.jobStageId;
      return taskService.deleteJobDefaultTestPaper(jobId, jobStageId);
    },
    onSuccess: (_data, param) => {
      const jobId = typeof param === "string" ? param : param.jobId;
      const jobStageId = typeof param === "string" ? undefined : param.jobStageId;
      
      queryClient.setQueryData(
        [QUERY_KEYS.JOBS.TASK_ASSIGNED, jobId, jobStageId],
        null
      );
      queryClient.setQueryData(
        [QUERY_KEYS.JOBS.TASK_ASSIGNED, jobId],
        null
      );
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.JOBS.TASK_ASSIGNED, jobId],
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

/**
 * Hook to add a new question to a predefined question set paper.
 */
export function useAddQuestionToPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paperId,
      question,
      skillIds,
    }: {
      paperId: string;
      question: QuestionItem | string;
      skillIds?: string[];
    }) => taskService.addQuestionToPaper(paperId, question, skillIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, variables.paperId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
      });
    },
  });
}

/**
 * Hook to update an existing question in a predefined question set paper.
 */
export function useUpdateQuestionInPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paperId,
      index,
      question,
      skillIds,
    }: {
      paperId: string;
      index: number;
      question: QuestionItem | string;
      skillIds?: string[];
    }) => taskService.updateQuestionInPaper(paperId, index, question, skillIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, variables.paperId],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
        refetchType: "all",
      });
    },
  });
}

/**
 * Hook to delete a question from a predefined question set paper.
 */
export function useDeleteQuestionFromPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paperId,
      index,
    }: {
      paperId: string;
      index: number;
    }) => taskService.deleteQuestionFromPaper(paperId, index),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, variables.paperId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
      });
    },
  });
}

/**
 * Hook to add a project task to a predefined question set paper.
 */
export function useAddProjectTaskToPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paperId,
      projectTask,
      skillIds,
    }: {
      paperId: string;
      projectTask: TaskItem | string;
      skillIds?: string[];
    }) => taskService.addProjectTaskToPaper(paperId, projectTask, skillIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, variables.paperId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
      });
    },
  });
}

/**
 * Hook to update a project task in a predefined question set paper.
 */
export function useUpdateProjectTaskInPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paperId,
      index,
      projectTask,
      skillIds,
    }: {
      paperId: string;
      index: number;
      projectTask: TaskItem | string;
      skillIds?: string[];
    }) => taskService.updateProjectTaskInPaper(paperId, index, projectTask, skillIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, variables.paperId],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
        refetchType: "all",
      });
    },
  });
}

/**
 * Hook to delete a project task from a predefined question set paper.
 */
export function useDeleteProjectTaskFromPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paperId,
      index,
    }: {
      paperId: string;
      index: number;
    }) => taskService.deleteProjectTaskFromPaper(paperId, index),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, variables.paperId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
      });
    },
  });
}



/**
 * Hook to add a new MCQ to a predefined question set paper.
 */
export function useAddMCQToPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paperId,
      mcq,
      skillIds,
    }: {
      paperId: string;
      mcq: MCQItem;
      skillIds?: string[];
    }) => taskService.addMCQToPaper(paperId, mcq, skillIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, variables.paperId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
      });
    },
  });
}

/**
 * Hook to update an MCQ in a predefined question set paper.
 */
export function useUpdateMCQInPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paperId,
      index,
      mcq,
      skillIds,
    }: {
      paperId: string;
      index: number;
      mcq: MCQItem;
      skillIds?: string[];
    }) => taskService.updateMCQInPaper(paperId, index, mcq, skillIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, variables.paperId],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
        refetchType: "all",
      });
    },
  });
}

/**
 * Hook to delete an MCQ from a predefined question set paper.
 */
export function useDeleteMCQFromPaperMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paperId,
      index,
    }: {
      paperId: string;
      index: number;
    }) => taskService.deleteMCQFromPaper(paperId, index),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, variables.paperId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
      });
    },
  });
}


