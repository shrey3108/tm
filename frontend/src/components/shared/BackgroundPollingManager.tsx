import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectActivePollings, stopPolling, type PollingEntry } from "@/store/slices/pollingSlice";
import { candidateStageService } from "@/apis/candidateStage";
import jobService from "@/apis/job";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { toast } from "sonner";
// import { extractErrorMessage } from "@/utils/error";
import { slugify } from "@/utils/slug";

interface SingleStagePollerProps {
  polling: PollingEntry;
  onNavigate: (path: string) => void;
}

const SingleStagePoller = ({ polling, onNavigate }: SingleStagePollerProps) => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Stagger the initial query to prevent rate limits
    const randomDelay = Math.random() * 14500 + 500;
    const timer = setTimeout(() => {
      setIsReady(true);
    }, randomDelay);
    return () => clearTimeout(timer);
  }, []);

  const { data } = useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION, polling.stageId],
    queryFn: () => candidateStageService.getEvaluation(polling.stageId),
    refetchInterval: 30000,
    staleTime: 0,
    enabled: isReady && !!polling.stageId,
  });

  useEffect(() => {
    if (data) {
      const status = data.status;
      if (status === "failed") {
        const errorMsg = data.error_message || "Evaluation processing failed";
        toast.error(`Evaluation for ${polling.candidateName} failed: ${errorMsg}`);
        dispatch(stopPolling(polling.stageId));
        invalidateQueries(queryClient, polling);
      } else if (status && status !== "processing") {
        const jobSlug = polling.jobTitle ? slugify(polling.jobTitle) : "";
        const candidateSlug = slugify(polling.candidateName);
        const stageSlug = slugify(polling.stageName);
        const path = `/dashboard/jobs/${jobSlug}/candidates/${candidateSlug}/stages/${stageSlug}`;

        toast.success(`Evaluation for ${polling.candidateName} generated successfully!`, {
          action: {
            label: "View",
            onClick: () => onNavigate(path),
          },
        });
        dispatch(stopPolling(polling.stageId));
        invalidateQueries(queryClient, polling);
      }
    }
  }, [data, polling, queryClient, dispatch, onNavigate]);

  return null;
};

const invalidateQueries = (queryClient: any, polling: PollingEntry) => {
  const { stageId, candidateId, jobId } = polling;
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION, stageId] });
  if (candidateId) {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.TRANSCRIPTS, candidateId] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE, candidateId] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASK_PAPERS.ASSIGNED, candidateId] });
    if (jobId) {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.DETAILS, jobId, candidateId] });
    }
  }
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION_HISTORY, stageId] });
};

const SingleResumePoller = ({
  polling,
  onNavigate,
}: {
  polling: PollingEntry;
  onNavigate: (path: string) => void;
}) => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Stagger the initial query to prevent rate limits
    const randomDelay = Math.random() * 14500 + 500;
    const timer = setTimeout(() => {
      setIsReady(true);
    }, randomDelay);
    return () => clearTimeout(timer);
  }, []);

  const { data } = useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.DETAILS, polling.jobId, polling.candidateId],
    queryFn: async () => {
      const response = await jobService.getJobCandidates(
        polling.jobId!,
        undefined,
        0,
        1,
        polling.candidateId!
      );
      return response.data?.[0] ?? null;
    },
    refetchInterval: 30000,
    staleTime: 0,
    enabled: isReady && !!polling.jobId && !!polling.candidateId,
  });

  useEffect(() => {
    if (data) {
      const status = data.processing_status;
      const isParsed = data.is_parsed;
      const errorMsg = data.processing_error;

      if (status === "failed") {
        const errorText = errorMsg || "Processing failed";
        toast.error(`Resume processing for ${polling.candidateName || polling.fileName || "Candidate"} failed: ${errorText}`);
        dispatch(stopPolling(polling.stageId));
        invalidateResumeQueries(queryClient, polling);
      } else if (isParsed && status !== "processing" && status !== "queued") {
        const candidateDisplayName = (data.first_name || data.last_name)
          ? `${data.first_name || ""} ${data.last_name || ""}`.trim()
          : polling.candidateName || polling.fileName || "Candidate";

        const jobSlug = polling.jobTitle ? slugify(polling.jobTitle) : ((data as any).job_name ? slugify((data as any).job_name) : "");
        const candidateSlug = slugify(candidateDisplayName);
        const stageSlug = "resume-screening";
        const path = `/dashboard/jobs/${jobSlug}/candidates/${candidateSlug}/stages/${stageSlug}`;

        const isReanalysis = polling.stageName === "Re-analysis";
        const toastMessage = isReanalysis
          ? `Re-analysis for ${candidateDisplayName} completed successfully!`
          : `Resume for ${candidateDisplayName} processed successfully!`;

        toast.success(toastMessage, {
          action: {
            label: "View",
            onClick: () => onNavigate(path),
          },
        });

        dispatch(stopPolling(polling.stageId));
        invalidateResumeQueries(queryClient, polling);
      }
    }
  }, [data, polling, queryClient, dispatch, onNavigate]);

  return null;
};

const invalidateResumeQueries = (queryClient: any, polling: PollingEntry) => {
  const { jobId, candidateId } = polling;
  if (jobId) {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOBS.CANDIDATES, jobId] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOBS.STATS, jobId] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOBS.DETAIL, jobId] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.DASHBOARD_DATA] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.LOCATIONS] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.AUDIT_LOGS] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.RECENT_UPLOADS] });
  }
  if (candidateId) {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.DETAILS, jobId, candidateId] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE, candidateId] });
  }
};

/**
 * BackgroundPollingManager Component
 * Monitors and polls candidate evaluations that are processing in the background,
 * and displays toast notifications regardless of what page the user is currently on.
 */
export const BackgroundPollingManager = () => {
  const activePollings = useAppSelector(selectActivePollings);
  const navigate = useNavigate();

  if (activePollings.length === 0) return null;

  return (
    <>
      {activePollings.map((polling) => {
        if (polling.type === "resume") {
          return (
            <SingleResumePoller
              key={polling.stageId}
              polling={polling}
              onNavigate={(path) => navigate(path)}
            />
          );
        }
        return (
          <SingleStagePoller
            key={polling.stageId}
            polling={polling}
            onNavigate={(path) => navigate(path)}
          />
        );
      })}
    </>
  );
};
