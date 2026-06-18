import jobService from "@/apis/job";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";
import { slugify } from "@/utils/slug";
import { adminJobService } from "@/apis/admin/job";

export const useJob = (jobId: string | null | undefined) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.JOBS.DETAIL, jobId],
    queryFn: () => jobService.getJob(jobId!),
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

export const useJobTitle = (q?: string, isEnable?: boolean) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.JOBS.DETAIL, q],
    queryFn: () => jobService.getJobTitles(q),
    staleTime: QUERY_CONFIG.JOB_DETAIL.staleTime,
    enabled: isEnable
  });

  return {
    data: res.data?.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};

export const useJobBySlugOrId = (
  jobId: string | null | undefined,
  jobSlug: string | undefined,
  enabled: boolean
) => {
  const isListEnabled = enabled && !jobId && !!jobSlug;

  // Query titles if we only have the slug
  const titlesQuery = useJobTitle(jobSlug, isListEnabled);

  // Find matching job ID from the list
  const resolvedJobId = jobId || (() => {
    if (!titlesQuery.data) return null;
    const found = titlesQuery.data.find((j) => slugify(j.title) === jobSlug);
    return found ? found.id : null;
  })();

  // Finally query the job detail using the resolved ID
  const detailQuery = useJob(resolvedJobId || undefined);

  // Determine query states
  const loading =
    (isListEnabled && titlesQuery.loading) ||
    (!!resolvedJobId && detailQuery.loading);

  const error = titlesQuery.error || detailQuery.error;

  return {
    data: detailQuery.data,
    loading,
    error,
    refetch: detailQuery.refetch,
  };
};

export const useJobStages = (jobId: string | null | undefined) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.JOB_STAGES, jobId],
    queryFn: () => adminJobService.getJobStages(jobId!),
    enabled: !!jobId,
    staleTime: QUERY_CONFIG.JOB_DETAIL.staleTime,
  });

  return {
    data: res.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};


export const useJobVersion = (versionId: string | null, enabled: boolean) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.JOBS.JOB_VERSION, versionId],
    queryFn: () => jobService.getJobVersion(versionId!),
    staleTime: QUERY_CONFIG.JOB_DETAIL.staleTime,
    enabled: enabled
  });

  return {
    data: res.data ?? null,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};


export const useJobTitlesGrouped = (q?: string, isEnable?: boolean) => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.JOBS.TITLES_GROUPED, q],
    queryFn: () => jobService.getJobTitlesGrouped(q),
    staleTime: QUERY_CONFIG.JOB_DETAIL.staleTime,
    enabled: isEnable
  });

  return {
    data: res.data?.data ?? [],
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};