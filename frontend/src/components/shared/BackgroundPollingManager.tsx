import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectActivePollings, stopPolling, type PollingEntry } from "@/store/slices/pollingSlice";
import { candidateStageService } from "@/apis/candidateStage";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { toast } from "sonner";
import { extractErrorMessage } from "@/utils/error";
// import { slugify } from "@/utils/slug";

interface SingleStagePollerProps {
  polling: PollingEntry;
  onNavigate: (path: string) => void;
}

const SingleStagePoller = ({ polling, onNavigate }: SingleStagePollerProps) => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  const { data, error } = useQuery({
    queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION, polling.stageId],
    queryFn: () => candidateStageService.getEvaluation(polling.stageId),
    refetchInterval: 15000,
    staleTime: 0,
  });

  useEffect(() => {
    if (data) {
      const status = (data as any).status;
      if (status === "failed") {
        const errorMsg = (data as any).error_message || "Evaluation processing failed";
        toast.error(`Evaluation for ${polling.candidateName} failed: ${errorMsg}`);
        dispatch(stopPolling(polling.stageId));
        invalidateQueries(queryClient, polling);
      } else if (status && status !== "processing") {
        // const jobSlug = polling.jobTitle ? slugify(polling.jobTitle) : "";
        // const candidateSlug = slugify(polling.candidateName);
        // const stageSlug = slugify(polling.stageName);
        // const path = `/dashboard/jobs/${jobSlug}/candidates/${candidateSlug}/stages/${stageSlug}`;

        toast.success(`Evaluation for ${polling.candidateName} generated successfully!`, {
          // action: {
          //   label: "View",
          //   onClick: () => onNavigate(path),
          // },
        });
        dispatch(stopPolling(polling.stageId));
        invalidateQueries(queryClient, polling);
      }
    } else if (error) {
      const responseStatus = (error as any)?.response?.status;
      const isResponseProcessing =
        typeof error === "object" &&
        "response" in error &&
        (error as any).response?.data?.status === "processing";

      // Do not stop polling if it's a 404 or a processing status
      if (responseStatus !== 404 && !isResponseProcessing) {
        const errorMsg = extractErrorMessage(error);
        toast.error(`Evaluation for ${polling.candidateName} failed: ${errorMsg}`);
        dispatch(stopPolling(polling.stageId));
        invalidateQueries(queryClient, polling);
      }
    }
  }, [data, error, polling, queryClient, dispatch, onNavigate]);

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
      {activePollings.map((polling) => (
        <SingleStagePoller
          key={polling.stageId}
          polling={polling}
          onNavigate={(path) => navigate(path)}
        />
      ))}
    </>
  );
};
