import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import jobService from "@/apis/job";
import { toast } from "sonner";
import { extractErrorMessage } from "@/utils/error";
import { slugify, unSlugify } from "@/utils/slug";
import type { CandidateAnalysis, JobStatsResponse } from "@/types/admin";
import type { Job } from "@/types/job";
import { useDeleteConfirmation } from "./useDeleteConfirmation";
import { resumeService } from "@/apis/resume";

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
  }
) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [candidates, setCandidates] = useState<CandidateAnalysis[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [reanalyzingCandidateIds, setReanalyzingCandidateIds] = useState<string[]>([]);
  const [jdVersion, setJdVersion] = useState<number | undefined>(undefined);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [jobStats, setJobStats] = useState<JobStatsResponse | null>(null);
  const currentJobId = useRef<string | null>(null);
  const jobStateRef = useRef<Job | null>(null);

  // Sync ref with state
  useEffect(() => {
    jobStateRef.current = job;
  }, [job]);

  // Extract filters from searchParams or use externalFilters
  const filters = useMemo(() => {
    if (externalFilters) return externalFilters;

    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");

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
    };
  }, [searchParams, externalFilters]);

  const fetchData = useCallback(
    async (isPolling = false) => {
      if (!jobSlug) return;

      const isInitialLoad = !jobStateRef.current && !isPolling;
      if (isInitialLoad) {
        setLoading(true);
      } else if (!isPolling) {
        setIsRefreshing(true);
      }

      try {
        let id = (location.state as JobRouteState | null)?.jobId || currentJobId.current;
        const skip = pageIndex * pageSize;
        const limit = pageSize;

        if (!id) {
          const response = await jobService.getJobTitles(unSlugify(jobSlug));
          const foundJob = response.data.find((j) => slugify(j.title) === jobSlug); // TODO: more better? or Just access via 0th index ?

          if (!foundJob) {
            toast.error("Job not found.");
            if (!isPolling) navigate("/dashboard/jobs");
            return;
          }
          id = foundJob.id;
        }

        currentJobId.current = id;

        if (isPolling) {
          const candidatesResponse = await jobService.getJobCandidates(id, jdVersion, skip, limit, undefined, undefined, filters);
          setCandidates(candidatesResponse.data || []);
          setTotalCandidates(candidatesResponse.total || 0);
        } else {
          // Fetch job data, candidates and stats when not polling
          const [jobData, candidatesResponse, statsData] = await Promise.all([
            jobService.getJob(id),
            jobService.getJobCandidates(id, jdVersion, skip, limit, undefined, undefined, filters),
            jobService.getJobStats(id, {
              start_date: filters.start_date,
              end_date: filters.end_date,
            }),
          ]);
          setJob(jobData);
          setCandidates(candidatesResponse.data || []);
          setTotalCandidates(candidatesResponse.total || 0);
          setJobStats(statsData);
        }
      } catch (error) {
        console.error("Failed to fetch job data:", error);
        const errorMessage = extractErrorMessage(error)
        if (!isPolling) {
          toast.error(errorMessage || "Failed to load candidates.");
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [jobSlug, location.state, navigate, jdVersion, pageIndex, pageSize, filters],
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !job) return;

    setIsUploading(true);
    const uploadPromises = Array.from(files).map(async (file) => {
      try {
        await jobService.uploadResume(job.id, file);
        toast.success(`Uploaded ${file.name} successfully!`);
      } catch (error) {
        const errorMessage = extractErrorMessage(error)
        console.error(`Failed to upload ${file.name}:`, error);
        toast.error(errorMessage || `Failed to upload ${file.name}`);
      }
    });

    await Promise.all(uploadPromises);
    setIsUploading(false);
    fetchData(true);
    if (event.target) event.target.value = "";
  };

  const handleReanalyzeCandidate = useCallback(
    async (candidateId: string) => {
      if (!job) return;
      setReanalyzingCandidateIds((current) => [...current, candidateId]);
      try {
        const response = await jobService.reanalyzeCandidate(job.id, candidateId);
        toast.success(response.message || "Re-analysis started successfully.");
        await fetchData(true);
      } catch (error) {
        const errorMessage = extractErrorMessage(error)
        console.error("Failed to reanalyze candidate:", error);
        toast.error(errorMessage || "Failed to start candidate re-analysis.");
      } finally {
        setReanalyzingCandidateIds((current) => current.filter((id) => id !== candidateId));
      }
    },
    [fetchData, job],
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
      jobService.reanalyzeCandidate(job.id, candidate.id).catch((err) => {
        console.error(`Failed to reanalyze ${candidate.id}:`, err);
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    toast.success("Requests sent for all candidates that need reanalysis.");
  }, [candidates, job, needsReanalysis]);

  const handleToggleStatus = useCallback(async () => {
    if (!job) return;
    try {
      const updatedJob = await jobService.updateJob(job.id, { is_active: !job.is_active });
      setJob(updatedJob);
      toast.success(`Job ${!job.is_active ? "activated" : "deactivated"} successfully`);
      await fetchData();
    } catch (error) {
      console.error("Failed to toggle job status:", error);
      const errorMessage = extractErrorMessage(error, "Failed to update job status");
      toast.error(errorMessage);
    }
  }, [job, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling
  useEffect(() => {
    const isAnyProcessing = candidates.some(
      (c) => c.processing_status === "processing" || !c.is_parsed,
    );
    if (isAnyProcessing) {
      const interval = setInterval(() => {
        fetchData(true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [candidates, fetchData]);


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
      await resumeService.deleteResume(jobId, candidate.resume_id);
    },
    onSuccess: () => {
      fetchData();
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
      totalCandidates: (jobStats?.hr_decisions.total_candidates || totalCandidates || candidates.length) ?? 0,
      passedCount: jobStats?.hr_decisions.passed ?? 0,
      failedCount: jobStats?.hr_decisions.failed ?? 0,
      maybeCount: jobStats?.hr_decisions.maybe ?? 0,
      undecidedCount: jobStats?.hr_decisions.pending ?? 0,
    },
    totalCandidates: (jobStats?.hr_decisions.total_candidates || totalCandidates || candidates.length) ?? 0,
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
