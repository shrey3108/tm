import { useQuery } from "@tanstack/react-query";
import { taskService } from "@/apis/task";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * Hook to retrieve the list of predefined question set paper templates.
 * Optionally filters by job and/or position level.
 */
export const useQuestionSetPapers = ({
  jobId,
  positionId,
  options,
}: {
  jobId?: string;
  positionId?: string;
  options?: Record<string, any>;
} = {}) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.TASK_PAPERS.LIST, jobId, positionId],
    queryFn: () => taskService.getQuestionSetPapers(jobId, positionId),
    staleTime: QUERY_CONFIG.TASK_PAPER.staleTime,
    ...options,
  });

  return {
    data: res.data ?? [],
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
export const useCandidateTestPaper = (candidateId: string | null | undefined) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.TASK_PAPERS.ASSIGNED, candidateId],
    queryFn: () => taskService.getCandidateTestPaper(candidateId!),
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

