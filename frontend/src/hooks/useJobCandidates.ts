import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { extractErrorMessage } from "@/utils/error";
import { slugify } from "@/utils/slug";
import type { CandidateAnalysis, JobStatsResponse } from "@/types/admin";
import type { Job } from "@/types/job";
import { useDeleteConfirmation } from "./useDeleteConfirmation";

import { useReanalyzeCandidateMutation, useUpdateJobMutation, } from "@/hooks/mutations/jobs/useJobMutations";
import { useUploadResumeMutation, useDeleteResumeMutation } from "@/hooks/mutations/jobs/useResumeMutation"
import { useJob, useJobTitle } from "@/hooks/queries/jobs/useJob";
import { useJobCandidatesList } from "@/hooks/queries/jobs/useJobCandidatesList";
import { useJobStats } from "@/hooks/queries/jobs/useJobStats";
type JobRouteState = {
  jobId?: string;
};

export const useJobCandidates = (
  jobSlug: string | undefined,
  pageIndex = 0,
  pageSize = 10,
  externalFilters?: {
    query?: string;
    hr_decision?: string[];
    start_date?: Date;
    end_date?: Date;
    activity_session?: string[];
    stage_id?: string[];
    city?: string[];
    result?: string[];
    hr_score?: number[];
    test_email_sent?: boolean;
  }
) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [candidates, setCandidates] = useState<CandidateAnalysis[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [reanalyzingCandidateIds, setReanalyzingCandidateIds] = useState<string[]>([]);
  const [jdVersion, setJdVersion] = useState<number | undefined>(undefined);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [jobStats, setJobStats] = useState<JobStatsResponse | null>(null);
  const currentJobId = useRef<string | null>(null);
  const jobStateRef = useRef<Job | null>(null);

  // Synchronize jobId from router state or ref
  const [resolvedJobId, setResolvedJobId] = useState<string | null>(
    () => (location.state as JobRouteState | null)?.jobId || currentJobId.current || null
  );

  // Sync ref with state
  useEffect(() => {
    jobStateRef.current = job;
  }, [job]);

  // Resolve job ID from slug if not available
  const { data: jobs, error: jobTitleError, loading: isJobTitleLoading } = useJobTitle(
    "",
    !!jobSlug && !resolvedJobId
  );

  useEffect(() => {
    if (resolvedJobId) return;

    // Error in fetching job title
    if (jobTitleError) {
      toast.error("Failed to fetch job title.");
      navigate("/dashboard/jobs");
      return;
    }

    if (isJobTitleLoading) return;

    if (jobs && jobs.length > 0) {
      const foundJob = jobs.find((j) => slugify(j.title) === jobSlug);
      if (foundJob) {
        setResolvedJobId(foundJob.id);
        currentJobId.current = foundJob.id;
      } else {
        toast.error("Job not found.");
        navigate("/dashboard/jobs");
      }
    } else if (jobs && jobs.length === 0) {
      toast.error("Job not found.");
      navigate("/dashboard/jobs");
    }
  }, [jobSlug, resolvedJobId, jobs, jobTitleError, isJobTitleLoading, navigate]);

  // Extract filters from searchParams or use externalFilters
  const filters = useMemo(() => {
    if (externalFilters) return externalFilters;

    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");
    const test_email_sent_param = searchParams.get("test_email_sent");

    return {
      query: searchParams.get("q") || undefined,
      hr_decision: searchParams.getAll("hr_decision"),
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
      activity_session: searchParams.getAll("activity_session"),
      stage_id: searchParams.getAll("stage_id"),
      city: searchParams.getAll("city"),
      result: searchParams.getAll("result"),
      hr_score: searchParams.getAll("hr_score").map(Number),
      test_email_sent: test_email_sent_param === "true" ? true : test_email_sent_param === "false" ? false : undefined,
    };
  }, [searchParams, externalFilters]);

  // TanStack Query hooks integration
  const {
    data: jobData,
    loading: jobLoading,
    refetch: refetchJob,
  } = useJob(resolvedJobId);

  const {
    data: candidatesData,
    loading: candidatesLoading,
    isRefreshing,
    refetch: refetchCandidates,
    total: candidatesTotal,
  } = useJobCandidatesList(
    resolvedJobId,
    jdVersion,
    pageIndex * pageSize,
    pageSize,
    filters
  );

  const {
    data: statsData,
    loading: statsLoading,
    refetch: refetchStats,
  } = useJobStats(resolvedJobId, {
    start_date: filters.start_date,
    end_date: filters.end_date,
  });

  const { mutateAsync: uploadResume } = useUploadResumeMutation();
  const { mutateAsync: reanalyzeCandidate } = useReanalyzeCandidateMutation();
  const { mutateAsync: updateJob } = useUpdateJobMutation();
  const { mutateAsync: deleteResume } = useDeleteResumeMutation();

  const loading = !resolvedJobId || jobLoading || candidatesLoading || statsLoading;

  // Synchronize query results to local states
  useEffect(() => {
    if (jobData) {
      setJob(jobData);
    }
  }, [jobData]);

  useEffect(() => {
    if (candidatesData) {
      setCandidates(candidatesData);
    }
  }, [candidatesData]);

  useEffect(() => {
    if (candidatesTotal !== undefined) {
      setTotalCandidates(candidatesTotal);
    }
  }, [candidatesTotal]);

  useEffect(() => {
    if (statsData) {
      setJobStats(statsData);
    }
  }, [statsData]);

  const fetchData = useCallback(
    async (_isPolling = false) => {
      refetchJob();
      refetchCandidates();
      refetchStats();
    },
    [refetchJob, refetchCandidates, refetchStats]
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !job) return;

    setIsUploading(true);
    try {
      const data = await uploadResume({
        jobId: job.id,
        files: Array.from(files),
        jobTitle: job.title,
      });
      const successCount = data.successful?.length || 0;
      const failedCount = data.failed?.length || 0;
      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} resume${successCount > 1 ? "s" : ""}!`);
      }
      if (failedCount > 0) {
        data.failed.forEach((fail) => {
          toast.error(`Failed to upload ${fail.file_name}: ${fail.error}`);
        });
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error, "Failed to upload resumes.");
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleReanalyzeCandidate = useCallback(
    async (candidateId: string) => {
      if (!job) return;
      setReanalyzingCandidateIds((current) => [...current, candidateId]);
      try {
        const candidate = candidates.find((c) => c.id === candidateId);
        const candidateName = candidate
          ? `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim()
          : "Candidate";
        const response = await reanalyzeCandidate({
          jobId: job.id,
          candidateId,
          candidateName,
          jobTitle: job.title,
        });
        toast.success(response.message || "Re-analysis started successfully.");
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        console.error("Failed to reanalyze candidate:", error);
        toast.error(errorMessage || "Failed to start candidate re-analysis.");
      } finally {
        setReanalyzingCandidateIds((current) => current.filter((id) => id !== candidateId));
      }
    },
    [reanalyzeCandidate, job, candidates],
  );

  const needsReanalysis = useCallback(
    (candidate: CandidateAnalysis): boolean => {
      if (
        candidate.processing_status === "processing" ||
        candidate.processing_status === "queued" ||
        reanalyzingCandidateIds.includes(candidate.id)
      ) {
        return false;
      }
      if (candidate.processing_status === "failed") return true;
      if (candidate.applied_version_number == null) return true;
      if (job?.version != null && candidate.applied_version_number < job.version) return true;
      return false;
    },
    [job, reanalyzingCandidateIds],
  );

  const handleReanalyzeAll = useCallback(async () => {
    if (!job || candidates.length === 0) return;
    const toReanalyze = candidates.filter(needsReanalysis);
    if (toReanalyze.length === 0) return;
    toast.info(`Re-analyzing ${toReanalyze.length} candidate(s)...`);
    for (const candidate of toReanalyze) {
      const candidateName = `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim();
      reanalyzeCandidate({
        jobId: job.id,
        candidateId: candidate.id,
        candidateName,
        jobTitle: job.title,
      }).catch((err) => {
        console.error(`Failed to reanalyze ${candidate.id}:`, err);
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    toast.success("Requests sent for all candidates that need reanalysis.");
  }, [candidates, job, needsReanalysis, reanalyzeCandidate]);

  const handleToggleStatus = useCallback(async () => {
    if (!job) return;
    try {
      const updatedJob = await updateJob({ jobId: job.id, data: { is_active: !job.is_active } });
      setJob(updatedJob);
      toast.success(`Job ${!job.is_active ? "activated" : "deactivated"} successfully`);
    } catch (error) {
      console.error("Failed to toggle job status:", error);
      const errorMessage = extractErrorMessage(error, "Failed to update job status");
      toast.error(errorMessage);
    }
  }, [job, updateJob]);



  const minDate = useMemo(() => {
    if (candidates.length === 0) return new Date();
    const dates = candidates.map((c) => new Date(c.created_at).getTime());
    return new Date(Math.min(...dates));
  }, [candidates]);

  const activitySession = useMemo(() => {
    if (!job?.activity_sessions) return [];
    const map = new Map<number, { start_date: string; end_date: string }>();
    job.activity_sessions.forEach((s) => map.set(s.session_id, { start_date: s.start_date, end_date: s.end_date || "" }));
    return Array.from(map);
  }, [job]);

  const {
    showModal: showDeleteModal,
    handleDeleteClick,
    handleClose: handleCloseDelete,
    handleConfirm: handleConfirmDelete,
    isDeleting,
    error: deleteError,
    message: deleteMessage,
  } = useDeleteConfirmation<CandidateAnalysis>({
    deleteFn: async (id) => {
      const candidate = candidates.find((c) => c.id === id);
      const jobId = (candidate as any)?.applied_job_id || job?.id;

      if (!candidate?.resume_id || !jobId) {
        throw new Error("Cannot delete: Missing job context or resume ID.");
      }
      await deleteResume({ jobId, resumeId: candidate.resume_id });
    },
    onSuccess: () => {
      toast.success("Candidate deleted successfully");
    },
    itemTitle: (c) => `${c.first_name || ""} ${c.last_name || ""}`.trim() || "this candidate",
  });

  return {
    candidates,
    job,
    loading,
    isRefreshing,
    isUploading,
    reanalyzingCandidateIds,
    fetchData,
    handleFileChange,
    handleReanalyzeCandidate,
    handleReanalyzeAll,
    handleToggleStatus,
    needsReanalysis,
    jobStats,
    jdVersion,
    setJdVersion,
    stats: {
      totalCandidates: (jobStats?.hr_decisions.total_candidates || totalCandidates) ?? 0,
      passedCount: jobStats?.hr_decisions.passed ?? 0,
      failedCount: jobStats?.hr_decisions.failed ?? 0,
      maybeCount: jobStats?.hr_decisions.maybe ?? 0,
      undecidedCount: jobStats?.hr_decisions.pending ?? 0,
    },
    totalCandidates: (totalCandidates || candidates.length) ?? 0,
    minDate,
    showDeleteModal,
    handleDeleteClick,
    handleCloseDelete,
    handleConfirmDelete,
    isDeleting,
    deleteError,
    deleteMessage,
    activitySession
  };
};
