import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
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
import {
  useResolvedJobAndCandidate,
  useJobStagesQuery,
  useCandidateEvaluationQuery,
  useCandidateEvaluationHistoryQuery,
  useCandidateTranscriptsQuery,
  useHrDecisionHistoryQuery,
  useCandidateDetailsQuery,
} from "./queries/candidates";
import { useSubmitDecisionMutation } from "./mutations/candidates/useCandidateStages";
import { QUERY_KEYS } from "@/constants/queryKeys";

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
    const stageNames = [{ stage: "Resume Screening", id: "resume-screening" }];
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

  // Reset selected history version when switching stages
  useEffect(() => {
    setSelectedEvaluationVersion(null);
  }, [instanceId, currentStage]);

  const evaluation = selectedEvaluationVersion || evaluationData || null;
  const error = evaluationError ? extractErrorMessage(evaluationError) : "";

  // 5. Invalidate evaluation related queries when AI polling finishes successfully
  useEffect(() => {
    if (isPolling && evaluationData) {
      setIsPolling(false);
      toast.success("Evaluation generated successfully!");
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.TRANSCRIPTS, candidate?.id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.EVALUATION_HISTORY, instanceId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE, candidate?.id] });
      setRefetchTimeline((prev) => prev + 1);
    }
  }, [isPolling, evaluationData, candidate?.id, instanceId, queryClient]);

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
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      toast.error(errorMessage || "Failed to submit decision");
    }
  };

  const candidateName = candidate
    ? `${candidate.first_name} ${candidate.last_name}`
    : params.candidateName || "Candidate";

  const transformedOverall = evaluation
    ? {
      stage_score: evaluation.overall_score || 0,
      recommendation: evaluation.recommendation || "N/A",
      overall_summary: evaluation.highlights?.overall_summary || "No summary available.",
      strength_summary: evaluation.highlights?.strengths || ["N/A"],
      weakness_summary: evaluation.highlights?.weaknesses || ["N/A"],
      followups: evaluation.highlights?.suggested_followups || ["N/A"],
      percentage: Math.round((evaluation.overall_score || 0) * 20),
    }
    : null;

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
    fetchHistory: () => {
      refetchHistory();
    },
    fetchHrDecisionHistory: async () => {
      await refetchHrDecisionHistory();
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CANDIDATES.TIMELINE, candidate?.id] });
    },
    setRefetchTimeline,
  };
}

