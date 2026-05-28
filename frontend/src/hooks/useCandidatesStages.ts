import { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { candidateDecisionSchema, type CandidateDecisionFormValues } from "@/schemas/candidate";
import { candidateDecisionApi, type HrDecisionHistoryItem } from "@/apis/candidateDecision";
import { extractErrorMessage } from "@/utils/error";
import type { Job } from "@/types/job";
import type { CandidateAnalysis } from "@/types/admin";
import { candidateStageService } from "@/apis/candidateStage";
import { transcriptService } from "@/apis/transcript";
import type { EvaluationRead, EvaluationHistoryRead } from "@/types/candidateStage";
import type { Transcript } from "@/types/transcript";
import { slugify } from "@/utils/slug";
import { jobStageService } from "@/apis/jobStage";
import jobService from "@/apis/job";

/**
 * A comprehensive hook for managing the state and logic of the Candidate Stages view.
 * Handles fetching candidate data, interview stages, evaluations, and transcript history.
 * Also manages polling for AI evaluation results and submitting HR decisions.
 * 
 * @returns An object containing all state and handler functions needed for the candidate stages UI.
 */
export function useCandidatesStages() {
  const { candidateName: candidateNameParam, stageSlug: stageSlugParam } = useParams<{
    jobSlug: string;
    candidateName: string;
    stageSlug: string;
  }>();

  const location = useLocation();

  const job = location.state?.job as Job;
  const candidate = location.state?.candidate as CandidateAnalysis;

  const getInitialStage = () => {
    if (stageSlugParam) {
      return stageSlugParam === "resume-screening" ? "Resume Screening" : stageSlugParam.replace(/-/g, " ");
    }
    return "Resume Screening";
  };

  const [stages, setStages] = useState<{ stage: string; id: string }[]>([]);
  const [currentStage, setCurrentStage] = useState(getInitialStage());

  // Sync currentStage with URL params
  useEffect(() => {
    if (stageSlugParam) {
      const stageName = stageSlugParam === "resume-screening" ? "Resume Screening" : stageSlugParam.replace(/-/g, " ");
      const foundStage = stages.find((s) => slugify(s.stage) === stageSlugParam);
      if (foundStage) {
        setCurrentStage(foundStage.stage);
      } else {
        setCurrentStage(stageName);
      }
    }
  }, [stageSlugParam, stages]);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [_isLoadingStages, setIsLoadingStages] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationRead | null>(null);
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState<Transcript[]>([]);
  const [hrDecisionHistory, setHrDecisionHistory] = useState<HrDecisionHistoryItem[]>([]);
  const [error, setError] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [candidateData, setCandidateData] = useState<CandidateAnalysis | null>(null);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [refetchTimeline, setRefetchTimeline] = useState(0);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [evaluationHistory, setEvaluationHistory] = useState<EvaluationHistoryRead[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isTranscriptDisabled, setIsTranscriptDisabled] = useState(true);

  useEffect(() => {
    const fetchCandidateData = async () => {
      if (!candidate?.id || !job?.id) return;
      try {
        const response = await jobService.getJobCandidates(job.id, undefined, 0, 1, candidate.id);
        if (response.data && response.data.length > 0) {
          setCandidateData(response.data[0]);
        }
      } catch (error) {
        console.error("Failed to fetch candidate details:", error);
      }
    };
    fetchCandidateData();
  }, [candidate?.id, job?.id]);

  useEffect(() => {
    const fetchStages = async () => {
      if (!job?.id) return;

      setIsLoadingStages(true);
      try {
        const _stages = await jobStageService.getJobStages(job.id);
        const stageNames = [
          { stage: "Resume Screening", id: "resume-screening" },
          ..._stages.map((stage) => ({ stage: stage.template.name, id: stage.id })),
        ];
        setStages(stageNames);

        if (!currentStage && stageNames.length > 0) {
          setCurrentStage(stageNames[0].stage);
        }
      } catch (error) {
        console.error("Failed to fetch stages:", error);
        toast.error("Failed to load interview stages");
      } finally {
        setIsLoadingStages(false);
      }
    };

    fetchStages();
  }, [job?.id]);

  const candidateStage = candidate?.pipeline?.find((s) => s.template_name === currentStage);
  const instanceId = candidateStage?.stage_id;
  const configId = candidateStage?.job_stage_id;

  const fetchEvaluation = async (showLoading = true) => {
    if (currentStage === "Resume Screening" || !instanceId) {
      setEvaluation(null);
      return;
    }

    if (showLoading) setIsLoadingEvaluation(true);
    try {
      await jobService.getJobCandidates(
        job.id,
        undefined,
        0,
        1,
        candidate.id,
        instanceId as string
      );

      const data = await candidateStageService.getEvaluation(instanceId as string);
      setEvaluation(data);
      setError("");

      if (isPolling && data) {
        setIsPolling(false);
        toast.success("Evaluation generated successfully!");
        fetchHistory();
        fetchEvaluationHistory();
        setRefetchTimeline((prev) => prev + 1);
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      if (!isPolling) {
        console.error("Failed to fetch evaluation:", errorMessage);
        setError(errorMessage);
        setEvaluation(null);
      }
    } finally {
      if (showLoading) setIsLoadingEvaluation(false);
    }
  };

  useEffect(() => {
    fetchEvaluation();
    setIsPolling(false);
  }, [instanceId, currentStage]);

  useEffect(() => {
    let interval: number;
    if (isPolling && instanceId) {
      interval = setInterval(() => {
        fetchEvaluation(false);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isPolling, instanceId]);

  const fetchEvaluationHistory = async () => {
    if (!instanceId || currentStage === "Resume Screening") return;
    setIsLoadingHistory(true);
    try {
      const history = await candidateStageService.getEvaluationHistory(instanceId);
      setEvaluationHistory(history);
    } catch (error) {
      console.error("Failed to fetch evaluation history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchEvaluationHistory();
  }, [instanceId, currentStage]);

  const handleSelectHistoryVersion = (version: EvaluationHistoryRead) => {
    const mappedEvaluation: EvaluationRead = {
      id: version.id,
      interview_id: version.interview_id,
      transcript_id: version.transcript_id,
      candidate_stage_id: version.candidate_stage_id,
      evaluation_data: (version.evaluation_data as any)?.criteria || version.evaluation_data,
      overall_score: version.overall_score,
      recommendation: version.result,
      sim_jd_resume: version.sim_jd_resume,
      sim_jd_transcript: version.sim_jd_transcript,
      sim_resume_transcript: version.sim_resume_transcript,
      created_at: version.created_at,
      highlights: version.highlights as any,
    };
    setEvaluation(mappedEvaluation);
  };

  const fetchHistory = async () => {
    if (!candidate?.id) return;
    try {
      const history = await transcriptService.getCandidateTranscripts(candidate.id);
      setTranscriptHistory(history);
    } catch (error) {
      console.error("Failed to fetch transcript history:", error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [candidate?.id]);

  const fetchHrDecisionHistory = async () => {
    if (!candidate?.id) return;
    try {
      const queryStageId = currentStage === "Resume Screening" ? undefined : configId;
      const response = await candidateDecisionApi.getDecisionHistory(candidate.id, job?.id, queryStageId as string);
      setHrDecisionHistory(response.decisions);
    } catch (error) {
      console.error("Failed to fetch HR decision history:", error);
    }
  };

  useEffect(() => {
    fetchHrDecisionHistory();
  }, [candidate?.id, job?.id, currentStage, configId]);

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

  const submitFeedback = async (data: CandidateDecisionFormValues) => {
    if (!candidate?.id) {
      toast.error("Candidate information missing");
      return;
    }
    setIsSubmitting(true);

    try {
      await candidateDecisionApi.submitDecision({
        candidate_id: candidate.id,
        decision: data.decision,
        note: data.note,
        stage_config_id: currentStage === "Resume Screening" ? undefined : (configId as string),
        job_id: job.id,
        score: data.score,
      });
      form.reset({ note: "", score: 0 });
      toast.success("Decision submitted successfully");
      setShowFeedbackModal(false);
      await fetchHrDecisionHistory();
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      toast.error(errorMessage || "Failed to submit decision");
    } finally {
      setIsSubmitting(false);
      setRefetchTimeline((prev) => prev + 1);
    }
  };

  const candidateName = candidate
    ? `${candidate.first_name} ${candidate.last_name}`
    : candidateNameParam || "Candidate";

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
    ? hrDecisionHistory?.filter((item) => item.stage_config_id == null || item?.stage_name === "Resume Screening")
    : hrDecisionHistory?.filter((item) => item.stage_config_id !== null && item.stage_config_id === configId);

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
    fetchHistory,
    fetchHrDecisionHistory,
    setRefetchTimeline,
  };
}
