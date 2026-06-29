import { useQuery, useQueries } from "@tanstack/react-query";
import { taskService } from "@/apis/task";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";


/**
 * Hook to retrieve the list of predefined question set paper templates.
 * Optionally filters by job, position level, department, skill, and paper type.
 */
export const useQuestionSetPapers = ({
  jobId,
  positionId,
  departmentId,
  skillId,
  paperType,
  q,
  skip,
  limit,
  options,
}: {
  jobId?: string;
  positionId?: string;
  departmentId?: string;
  skillId?: string;
  paperType?: string;
  q?: string;
  skip?: number;
  limit?: number;
  options?: Record<string, any>;
} = {}) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.TASK_PAPERS.LIST, jobId, positionId, departmentId, skillId, paperType, q, skip, limit],
    queryFn: () =>
      taskService.getQuestionSetPapers({
        jobId,
        positionId,
        departmentId,
        skillId,
        paperType,
        q,
        skip,
        limit,
      }),
    staleTime: QUERY_CONFIG.TASK_PAPER.staleTime,
    ...options,
  });

  return {
    data: res.data?.data ?? [],
    total: res.data?.total ?? 0,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};

/**
 * Hook to retrieve unique questions, tasks, and MCQs across predefined question set papers.
 */
export const useAllQuestionsAndTasks = ({
  jobId,
  positionId,
  departmentId,
  skillId,
  paperType,
  q,
  skip,
  limit,
  options,
}: {
  jobId?: string;
  positionId?: string;
  departmentId?: string;
  skillId?: string;
  paperType?: string;
  q?: string;
  skip?: number;
  limit?: number;
  options?: Record<string, any>;
} = {}) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT, jobId, positionId, departmentId, skillId, paperType, q, skip, limit],
    queryFn: () =>
      taskService.getAllQuestionsAndTasks({
        jobId,
        positionId,
        departmentId,
        skillId,
        paperType,
        q,
        skip,
        limit,
      }),
    staleTime: QUERY_CONFIG.TASK_PAPER.staleTime,
    ...options,
  });

  return {
    data: res.data ?? { questions: [], project_task: [], mcqs: [] },
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};

/**
 * Hook to retrieve a specific predefined question set paper template.
 */
export const useQuestionSetPaper = (paperId: string | null | undefined) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, paperId],
    queryFn: () => taskService.getQuestionSetPaper(paperId!),
    enabled: !!paperId,
    staleTime: QUERY_CONFIG.TASK_PAPER.staleTime,
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};

/**
 * Hook to retrieve the test paper currently assigned to a candidate.
 */
export const useCandidateTestPaper = (
  candidateId: string | null | undefined,
  _jobStageId?: string // TODO: Temporarily disabled, will enable when backend fix the issue
) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.TASK_PAPERS.ASSIGNED, candidateId],
    queryFn: () => taskService.getCandidateTestPaper(candidateId!), // pass jobStageId again when backend fix issue
    enabled: !!candidateId,
    staleTime: QUERY_CONFIG.TASK_PAPER.staleTime,
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};

/**
 * Hook to retrieve test papers currently assigned to multiple candidates.
 */
export const useCandidatesTestPapers = (candidateIds: (string | null | undefined)[]) => {
  const results = useQueries({
    queries: (candidateIds || []).map((id) => ({
      queryKey: [QUERY_KEYS.TASK_PAPERS.ASSIGNED, id],
      queryFn: () => taskService.getCandidateTestPaper(id!),
      enabled: !!id,
      staleTime: QUERY_CONFIG.TASK_PAPER.staleTime,
    })),
  });

  return {
    data: results.map((r) => r.data ?? null),
    loading: results.some((r) => r.isLoading),
    error: results.find((r) => r.error)?.error ?? null,
    refetch: () => results.forEach((r) => r.refetch()),
  };
};


/**
 * Hook to retrieve a candidate's task metadata (path, extracted skills, is_custom flag).
 */
export const useCandidateTaskMetadata = (candidateId: string | null | undefined) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.TASK_PAPERS.TASK_METADATA, candidateId],
    queryFn: () => taskService.readCandidateTaskMetadata(candidateId!),
    enabled: !!candidateId,
    staleTime: QUERY_CONFIG.TASK_PAPER.staleTime,
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};

/**
 * Hook to retrieve a consolidated list of skills required for the job and candidate task skills.
 */
export const useJobAndCandidateTaskSkills = (
  candidateId: string | null | undefined,
  jobId: string | null | undefined
) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.TASK_PAPERS.SKILLS, candidateId, jobId],
    queryFn: () => taskService.getJobAndCandidateTaskSkills(candidateId!, jobId!),
    enabled: !!candidateId && !!jobId,
    staleTime: QUERY_CONFIG.TASK_PAPER.staleTime,
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};

/**
 * Hook to download a predefined test paper task file.
 */
export const useDownloadPaperTaskFile = (
  paperId: string | null | undefined,
  options?: Record<string, any>
) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.TASK_PAPERS.DOWNLOAD, paperId],
    queryFn: () => taskService.downloadPaperTaskFile(paperId!),
    enabled: !!paperId,
    staleTime: QUERY_CONFIG.TASK_PAPER.staleTime,
    ...options,
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading || res.isFetching,
    error: res.error,
    refetch: res.refetch,
  };
};

/**
 * Hook to download the task file assigned to a candidate.
 */
export const useDownloadCandidateAssignedTaskFile = (
  candidateId: string | null | undefined,
  options?: Record<string, any>
) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.TASK_PAPERS.DOWNLOAD, "assigned", candidateId],
    queryFn: () => taskService.downloadCandidateAssignedTaskFile(candidateId!),
    enabled: !!candidateId,
    staleTime: QUERY_CONFIG.TASK_PAPER.staleTime,
    ...options,
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading || res.isFetching,
    error: res.error,
    refetch: res.refetch,
  };
};

/**
 * Hook to retrieve the assignment and email log history for a specific candidate's test paper.
 * Only fetches when candidateId is provided.
 */
export const useCandidateTestPaperHistory = (
  candidateId: string | null | undefined,
  jobStageId?: string
) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.TASK_PAPERS.HISTORY, candidateId, jobStageId],
    queryFn: () => taskService.getCandidateTestPaperHistory(candidateId!, jobStageId),
    enabled: !!candidateId,
    staleTime: QUERY_CONFIG.TASK_PAPER.staleTime,
  });

  return {
    data: res.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};

