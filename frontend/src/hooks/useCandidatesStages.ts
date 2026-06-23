import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { candidateDecisionSchema, type CandidateDecisionFormValues } from "@/schemas/candidate";
import { extractErrorMessage } from "@/utils/error";
import type { Job } from "@/types/job";
import type { CandidateAnalysis } from "@/types/admin";
import type { EvaluationRead, EvaluationHistoryRead } from "@/types/candidateStage";
import { slugify } from "@/utils/slug";
import type { HrDecisionHistoryItem } from "@/apis/candidateDecision";
import type { OverallSummaryData } from "@/components/candidate/StageOverallSummary";
import {
  useResolvedJobAndCandidate,
  useJobStagesQuery,
  useCandidateEvaluationQuery,
  useCandidateEvaluationHistoryQuery,
  useCandidateTranscriptsQuery,
  useHrDecisionHistoryQuery,
  useCandidateDetailsQuery,
} from "./queries/candidates";
import {
  useSubmitDecisionMutation,
  useRetryEvaluationMutation,
} from "./mutations/candidates/useCandidateStages";
import { QUERY_KEYS } from "@/constants/queryKeys";
// import { TEMP_TECHNICAL_ROUND_HR_DECISION, TEMP_TECHNICAL_ROUND_RESPONSE } from "@/constants/temp";

/**
 * A comprehensive hook for managing the state and logic of the Candidate Stages view.
 * Handles fetching candidate data, interview stages, evaluations, and transcript history
 * using TanStack Query.
 */
export function useCandidatesStages() {
  const params = useParams<{
    jobSlug: string;
    candidateName: string;
    stageSlug: string;
  }>();
  const navigate = useNavigate()

  const location = useLocation();
  const queryClient = useQueryClient();

  // 1. Resolve Job and Candidate (supports robust refresh via TanStack Query fallback)
  const { job, candidate } = useResolvedJobAndCandidate(
    params.jobSlug,
    params.candidateName,
    location.state?.job as Job | null,
    location.state?.candidate as CandidateAnalysis | null
  );

  const getInitialStage = () => {
    if (params.stageSlug) {
      return params.stageSlug === "resume-screening" ? "Resume Screening" : params.stageSlug.replace(/-/g, " ");
    }
    return "Resume Screening";
  };

  const [currentStage, setCurrentStage] = useState(getInitialStage());

  // 2. Fetch job-specific stages using query
  const { data: jobStagesRaw } = useJobStagesQuery(job?.id);
  const stages = useMemo(() => {
    // const stageNames = [{ stage: "Resume Screening", id: "resume-screening" }];
    const stageNames = [];
    if (jobStagesRaw) {
      stageNames.push(
        ...jobStagesRaw.map((stage) => ({ stage: stage.template.name, id: stage.id }))
      );
    }
    return stageNames;
  }, [jobStagesRaw]);

  // Sync currentStage with URL params
  useEffect(() => {
    if (params.stageSlug) {
      const stageName = params.stageSlug === "resume-screening" ? "Resume Screening" : params.stageSlug.replace(/-/g, " ");
      const foundStage = stages.find((s) => slugify(s.stage) === params.stageSlug);
      if (foundStage) {
        setCurrentStage(foundStage.stage);
      } else {
        setCurrentStage(stageName);
      }
    }
  }, [params.stageSlug, stages]);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [refetchTimeline, setRefetchTimeline] = useState(0);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isTranscriptDisabled, setIsTranscriptDisabled] = useState(true);

  // 3. Candidate data query
  const { data: candidateData } = useCandidateDetailsQuery(job?.id, candidate?.id);

  const candidateStage = candidate?.pipeline?.find((s) => s.template_name === currentStage);
  const instanceId = candidateStage?.stage_id;
  const configId = candidateStage?.job_stage_id;

  // 4. Candidate evaluation query (with polling supported)
  const {
    data: evaluationData,
    isLoading: isLoadingEvaluationQuery,
    error: evaluationError,
  } = useCandidateEvaluationQuery(instanceId, isPolling);

  // Selected history version override for evaluation view
  const [selectedEvaluationVersion, setSelectedEvaluationVersion] = useState<EvaluationRead | null>(null);

  // Reset selected history version and polling state when switching stages
  useEffect(() => {
    setSelectedEvaluationVersion(null);
    setIsPolling(false);
  }, [instanceId, currentStage]);

  // Check if response indicates the evaluation is processing
  const isResponseProcessing = useMemo(() => {
    if (evaluationData && (evaluationData as any).status === "processing") {
      return true;
    }
    if (evaluationError && typeof evaluationError === "object" && "response" in evaluationError) {
      const responseData = (evaluationError as any).response?.data;
      if (responseData && responseData.status === "processing") {
        return true;
      }
    }
    return false;
  }, [evaluationData, evaluationError]);

  // Start polling if we receive a processing response
  useEffect(() => {
    if (isResponseProcessing && !isPolling) {
      setIsPolling(true);
    }
  }, [isResponseProcessing, isPolling]);

  const hasValidEvaluationData = evaluationData &&
    (evaluationData as any).status !== "processing" &&
    (evaluationData as any).status !== "failed";
  let evaluation = selectedEvaluationVersion || (hasValidEvaluationData ? evaluationData : null);
  const error = (evaluationError && !isResponseProcessing)
    ? extractErrorMessage(evaluationError)
    : (evaluationData && (evaluationData as any).status === "failed")
      ? (evaluationData as any).error_message || "Evaluation processing failed"
      : "";

  // // 5. Invalidate evaluation related queries when AI polling finishes
  useEffect(() => {
    if (isPolling && evaluationData && !isResponseProcessing) {
      setIsPolling(false);
      const isFailed = (evaluationData as any).status === "failed";
      if (isFailed) {
        toast.error((evaluationData as any).error_message || "Evaluation processing failed");
      } else {
        toast.success("Evaluation generated successfully!");
      }
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.TRANSCRIPTS, candidate?.id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION_HISTORY, instanceId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE, candidate?.id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.DETAILS, job?.id, candidate?.id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASK_PAPERS.ASSIGNED, candidate?.id] });
      setRefetchTimeline((prev) => prev + 1);
    }
  }, [isPolling, evaluationData, isResponseProcessing, candidate?.id, instanceId, queryClient, job?.id]);

  const isLoadingEvaluation = isLoadingEvaluationQuery && !evaluationData;

  // 6. Evaluation History Query
  const { data: evaluationHistoryData, isLoading: isLoadingHistory } =
    useCandidateEvaluationHistoryQuery(
      currentStage === "Resume Screening" ? undefined : instanceId
    );
  const evaluationHistory = evaluationHistoryData ?? [];

  const handleSelectHistoryVersion = (version: EvaluationHistoryRead) => {
    const mappedEvaluation: EvaluationRead = {
      id: version.id,
      interview_id: version.interview_id,
      transcript_id: version.transcript_id,
      candidate_stage_id: version.candidate_stage_id,
      evaluation_data: version.evaluation_data?.criteria || version.evaluation_data,
      overall_score: version.overall_score,
      recommendation: version.result,
      sim_jd_resume: version.sim_jd_resume,
      sim_jd_transcript: version.sim_jd_transcript,
      sim_resume_transcript: version.sim_resume_transcript,
      created_at: version.created_at,
      highlights: {
        overall_summary: version.highlights?.overall_summary || "",
        recommendation: version.highlights?.recommendation || "",
        strengths: version.highlights?.strengths || [],
        weaknesses: version.highlights?.weaknesses || [],
        suggested_followups: version.highlights?.suggested_followups || [],
      },
    };
    setSelectedEvaluationVersion(mappedEvaluation);
  };

  // 7. Transcript History Query
  const { data: transcriptHistoryData, refetch: refetchHistory } =
    useCandidateTranscriptsQuery(candidate?.id, evaluation?.transcript_id);
  const transcriptHistory = transcriptHistoryData ?? [];

  // 8. HR Decision History Query
  const queryStageId = currentStage === "Resume Screening" ? undefined : configId;
  const { data: hrDecisionHistoryResponse, refetch: refetchHrDecisionHistory } =
    useHrDecisionHistoryQuery(candidate?.id, job?.id, queryStageId);

  const hrDecisionHistory = hrDecisionHistoryResponse?.decisions ?? [];

  const form = useForm<CandidateDecisionFormValues>({
    resolver: zodResolver(candidateDecisionSchema),
    defaultValues: {
      note: "",
      score: 0,
    },
  });

  const handleAction = (type: CandidateDecisionFormValues["decision"]) => {
    form.reset({
      decision: type,
      note: form.watch("note") || "",
      score: form.watch("score") || 0,
    });
    form.clearErrors();
    setShowFeedbackModal(true);
  };


  // 9. Mutation for submitting feedback
  const submitDecisionMutation = useSubmitDecisionMutation();
  const isSubmitting = submitDecisionMutation.isPending;

  const submitFeedback = async (data: CandidateDecisionFormValues) => {
    if (!candidate?.id) {
      toast.error("Candidate information missing");
      return;
    }

    try {
      await submitDecisionMutation.mutateAsync({
        candidate_id: candidate.id,
        decision: data.decision,
        note: data.note,
        stage_config_id: currentStage === "Resume Screening" ? undefined : (configId as string),
        job_id: job!.id,
        score: data.score,
      });
      form.reset({ note: "", score: 0 });
      toast.success("Decision submitted successfully");
      setShowFeedbackModal(false);
      setRefetchTimeline((prev) => prev + 1);

      const candidateFullName = slugify(`${candidate.first_name || ""} ${candidate.last_name || ""}`);
      const jobSlug = slugify(job?.title);

      let nextStageName = currentStage;

      // Navigate to next stage ONLY if the candidate passed the current stage
      if (data.decision === "pass") {
        const currentIndex = stages.findIndex((s) => s.stage === currentStage);
        if (currentIndex !== -1 && currentIndex < stages.length - 1) {
          nextStageName = stages[currentIndex + 1].stage;
        }
      }

      const stageSlug = slugify(nextStageName);

      navigate(`/dashboard/jobs/${jobSlug}/candidates/${candidateFullName}/stages/${stageSlug}`, {
        state: {
          candidate: candidate,
          jobSlug: jobSlug,
          job
        }, replace: true
      });
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      toast.error(errorMessage || "Failed to submit decision");
    }
  };

  const retryMutation = useRetryEvaluationMutation();
  const isRetrying = retryMutation.isPending;

  const isFailedEvaluation = !!(
    (evaluationData && (evaluationData as any).status === "failed") ||
    (evaluationError && !isResponseProcessing && (evaluationError as any)?.response?.status !== 404)
  );




  const handleRetry = async () => {
    if (!instanceId) return;
    try {
      await retryMutation.mutateAsync({ stageId: instanceId });
      // Reset the cache to processing state to avoid using the old failed evaluation status
      queryClient.setQueryData(
        [QUERY_KEYS.CANDIDATES.EVALUATION, instanceId],
        { status: "processing" }
      );
      toast.success("Retry evaluation triggered successfully");
      setIsPolling(true);
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Failed to trigger retry evaluation");
    }
  };

  const candidateName = candidate
    ? `${candidate.first_name} ${candidate.last_name}`
    : params.candidateName || "Candidate";

  const transformedOverall = useMemo(() => {
    if (!evaluation) return null;

    // Helper to extract nested list or string values from evaluation_data
    let extractedSummary = "";
    let extractedStrengths: string[] = [];
    let extractedWeaknesses: string[] = [];
    let extractedFollowups: string[] = [];

    const evalData = evaluation.evaluation_data;
    if (evalData && typeof evalData === "object") {
      Object.values(evalData).forEach((val) => {
        if (Array.isArray(val)) {
          val.forEach((item) => {
            if (item && typeof item === "object" && !Array.isArray(item)) {
              if ("overall_summary" in item && typeof item.overall_summary === "string") {
                extractedSummary = item.overall_summary;
              }
              if ("strengths" in item && Array.isArray(item.strengths)) {
                extractedStrengths = item.strengths;
              }
              if ("weaknesses" in item && Array.isArray(item.weaknesses)) {
                extractedWeaknesses = item.weaknesses;
              }
              if ("suggested_followups" in item && Array.isArray(item.suggested_followups)) {
                extractedFollowups = item.suggested_followups;
              }
            }
          });
        }
      });
    }

    const overall_summary = evaluation.highlights?.overall_summary || extractedSummary || "No summary available.";

    // Check if this is a GitHub Evaluation with specific keys
    const github_highlights: Record<string, string[]> = {};
    if (evaluation.highlights) {
      ["Architectural Review", "Code Quality Review", "Identified Security Risks", "Extraordinary Points"].forEach(key => {
        if (evaluation.highlights[key]) {
          github_highlights[key] = evaluation.highlights[key];
        }
      });
    }

    const hasGithubHighlights = Object.keys(github_highlights).length > 0;

    const strength_summary = (!hasGithubHighlights && evaluation.highlights?.strengths && evaluation.highlights.strengths.length > 0)
      ? evaluation.highlights.strengths
      : (extractedStrengths.length > 0 ? extractedStrengths : ["N/A"]);
    const weakness_summary = (!hasGithubHighlights && evaluation.highlights?.weaknesses && evaluation.highlights.weaknesses.length > 0)
      ? evaluation.highlights.weaknesses
      : (extractedWeaknesses.length > 0 ? extractedWeaknesses : ["N/A"]);
    const followups = (!hasGithubHighlights && evaluation.highlights?.suggested_followups && evaluation.highlights.suggested_followups.length > 0)
      ? evaluation.highlights.suggested_followups
      : (extractedFollowups.length > 0 ? extractedFollowups : ["N/A"]);

    return {
      stage_score: evaluation.overall_score || 0,
      recommendation: evaluation.recommendation || "N/A",
      overall_summary: hasGithubHighlights ? undefined : overall_summary,
      strength_summary: hasGithubHighlights ? undefined : strength_summary,
      weakness_summary: hasGithubHighlights ? undefined : weakness_summary,
      followups: hasGithubHighlights ? undefined : followups,
      percentage: Math.round((evaluation.overall_score || 0) * 20),
      github_highlights: hasGithubHighlights ? github_highlights : undefined,
    } as OverallSummaryData;
  }, [evaluation]);

  const isResumeScreening = currentStage === "Resume Screening";
  const filteredHistory = isResumeScreening
    ? hrDecisionHistory?.filter(
      (item: HrDecisionHistoryItem) => item.stage_config_id == null || item?.stage_name === "Resume Screening"
    )
    : hrDecisionHistory?.filter(
      (item: HrDecisionHistoryItem) => item.stage_config_id !== null && item.stage_config_id === configId
    );

  const latestDecision = filteredHistory ? filteredHistory[0] : hrDecisionHistory[0];
  const canTakeDecision = !latestDecision || latestDecision.decision.toLowerCase() === "may be";


  return {
    job,
    candidate,
    candidateName,
    currentStage,
    setCurrentStage,
    stages,
    showFeedbackModal,
    setShowFeedbackModal,
    isSubmitting,
    isJobModalOpen,
    setIsJobModalOpen,
    evaluation,
    isLoadingEvaluation,
    transcriptHistory,
    hrDecisionHistory,
    error,
    isPolling,
    setIsPolling,
    candidateData,
    showAllSkills,
    setShowAllSkills,
    refetchTimeline,
    isDetailsModalOpen,
    setIsDetailsModalOpen,
    evaluationHistory,
    isLoadingHistory,
    isHistoryModalOpen,
    setIsHistoryModalOpen,
    isTranscriptDisabled,
    setIsTranscriptDisabled,
    latestDecision,
    filteredHistory,
    canTakeDecision,
    transformedOverall,
    instanceId,
    form,
    handleAction,
    submitFeedback,
    handleSelectHistoryVersion,
    isFailedEvaluation,
    handleRetry,
    isRetrying,
    fetchHistory: () => {
      refetchHistory();
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.DETAILS, job?.id, candidate?.id] });
      if (instanceId) {
        // Clear/set evaluation cache to processing state to avoid using old failed evaluation data
        queryClient.setQueryData(
          [QUERY_KEYS.CANDIDATES.EVALUATION, instanceId],
          { status: "processing" }
        );
      }
    },
    fetchHrDecisionHistory: async () => {
      await refetchHrDecisionHistory();
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE, candidate?.id] });
    },
    handlePaperChange: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE, candidate?.id] });
    },
    setRefetchTimeline,
  };
}

