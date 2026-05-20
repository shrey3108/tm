import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { EvaluationGrid } from "@/components/candidate/EvaluationGrid";
import { StageOverallSummary } from "@/components/candidate/StageOverallSummary";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import AppPageShell from "@/components/shared/AppPageShell";
import { ActionButtons } from "@/components/modal/candidate-details/ActionButtons";
import { FeedbackDialog } from "@/components/modal/candidate-details/FeedbackDialog";
import { candidateDecisionSchema, type CandidateDecisionFormValues } from "@/schemas/candidate";
import { candidateDecisionApi, type HrDecisionHistoryItem } from "@/apis/candidateDecision";
import { extractErrorMessage } from "@/utils/error";
import type { Job } from "@/types/job";
import type { CandidateAnalysis } from "@/types/admin";
import { StageCandidatesHeader } from "@/components/candidate/StageCandidatesHeader";
import { JobInfoModal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { candidateStageService } from "@/apis/candidateStage";
import { transcriptService } from "@/apis/transcript";
import { Loader2, FileText, Info, History } from "lucide-react";
import type { EvaluationRead, EvaluationHistoryRead } from "@/types/candidateStage";
import type { Transcript } from "@/types/transcript";
import { CandidateHistoryGrid } from "@/components/candidate/CandidateHistoryGrid";
import { EvaluationHistoryModal } from "@/components/modal/candidate-details/EvaluationHistoryModal";
import { CandidateTimeline } from "@/components/candidate/CandidateTimeline";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { slugify } from "@/utils/slug";
import { jobStageService } from "@/apis/jobStage";
import { AnalysisContent } from "@/components/modal/candidate-details/AnalysisContent";
import { DecisionHistory } from "@/components/modal/candidate-details/DecisionHistory";
import jobService from "@/apis/job";
import { CandidateDetailsModal } from "@/components/modal/CandidateDetailsModal";
import { HrDecision } from "@/components/modal/candidate-details/HrDecision";
import { Badge } from "@/components";


export default function CandidatesStages() {
  const { candidateName: candidateNameParam, stageSlug: stageSlugParam } = useParams<{
    jobSlug: string;
    candidateName: string;
    stageSlug: string
  }>();

  const location = useLocation();
  const navigate = useNavigate();
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
      // Try to find the exact name from loaded stages to handle casing correctly
      const foundStage = stages.find(s => slugify(s.stage) === stageSlugParam);
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
        const response = await jobService.getJobCandidates(
          job.id,
          undefined,
          0,
          1,
          candidate.id
        );
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
        // const stats = await jobService.getJobStats(job.id);
        const _stages = await jobStageService.getJobStages(job.id);
        const stageNames = [
          { stage: "Resume Screening", id: "resume-screening" },
          ..._stages.map((stage) => ({ stage: stage.template.name, id: stage.id }))
        ];
        setStages(stageNames);

        // If no current stage was set from candidate, set it to the first stage
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

  const candidateStage = candidate.pipeline?.find(
    (s) => s.template_name === currentStage
  );


  const instanceId = candidateStage?.stage_id;
  const configId = candidateStage?.job_stage_id;

  // console.log(candidateStage, 'candidateStage')

  const fetchEvaluation = async (showLoading = true) => {
    if (currentStage === "Resume Screening" || !instanceId) {
      setEvaluation(null);
      return;
    }

    if (showLoading) setIsLoadingEvaluation(true);
    try {
      // Optional: Update candidate details if needed
      await jobService.getJobCandidates(
        job.id,
        undefined,
        0,
        1,
        candidate.id,
        // configId as string,
        instanceId as string
      );

      const data = await candidateStageService.getEvaluation(instanceId as string);
      setEvaluation(data);
      setError("");

      // If we were polling and finally got data, stop polling
      if (isPolling && data) {
        setIsPolling(false);
        toast.success("Evaluation generated successfully!");
        fetchHistory(); // Refresh history to show the new transcript
        fetchEvaluationHistory(); // Refresh evaluation history
        setRefetchTimeline(prev => prev + 1); // refetch the timeline after polling is done
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      // If polling, we expect 404s or other errors until the evaluation is ready
      if (!isPolling) {
        console.error("Failed to fetch evaluation:", errorMessage);
        // toast.error(errorMessage || "Failed to fetch evaluation Or Something went wrong");
        setError(errorMessage);
        setEvaluation(null);
      }
    } finally {
      if (showLoading) setIsLoadingEvaluation(false);
    }
  };

  useEffect(() => {
    fetchEvaluation();
    // Reset polling if stage changes
    setIsPolling(false);
  }, [instanceId, currentStage]);

  useEffect(() => {
    let interval: number;
    if (isPolling && instanceId) {
      interval = setInterval(() => {
        fetchEvaluation(false); // Poll without global loading state
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

  const handleAction = (type: CandidateDecisionFormValues['decision']) => {
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
        stage_config_id: currentStage === "Resume Screening" ? undefined : configId as string,
        job_id: job.id,
        score: data.score
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
      setRefetchTimeline(prev => prev + 1);
    }
  };

  // Ensure names are formatted for display
  const candidateName = candidate ? `${candidate.first_name} ${candidate.last_name}` : candidateNameParam || "Candidate";

  const transformedOverall = evaluation ? {
    stage_score: evaluation.overall_score || 0,
    recommendation: evaluation.recommendation || "N/A",
    overall_summary: evaluation.highlights?.overall_summary || "No summary available.",
    strength_summary: evaluation.highlights?.strengths || ["N/A"],
    weakness_summary: evaluation.highlights?.weaknesses || ["N/A"],
    followups: evaluation.highlights?.suggested_followups || ["N/A"],
    percentage: Math.round((evaluation.overall_score || 0) * 20)
  } : null;


  const isResumeScreening = currentStage === "Resume Screening";
  const filteredHistory = isResumeScreening
    ? hrDecisionHistory?.filter((item) => item.stage_config_id == null || item?.stage_name === "Resume Screening")
    : hrDecisionHistory?.filter((item) => item.stage_config_id !== null && item.stage_config_id === configId);

  const latestDecision = filteredHistory ? filteredHistory[0] : hrDecisionHistory[0];
  const canTakeDecision = !latestDecision || latestDecision.decision.toLowerCase() === "may be";

  // console.log({ isResumeScreening, hrDecisionHistory, configId, filteredHistory });

  return (
    <AppPageShell width="full" className="p-0 overflow-hidden bg-background">
      <StageCandidatesHeader
        job={job}
        candidateName={candidateName}
        onBack={() => navigate(-1)}
        onInfoClick={() => setIsJobModalOpen(true)}
        isUploaded={isTranscriptDisabled}
        onSuccess={() => {
          setIsPolling(true);
          fetchHistory();
        }}
        stageId={instanceId as string}
        stageName={currentStage}
      />
      <div className="flex overflow-hidden">

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Header */}
          <CandidateTimeline
            candidateId={candidate?.id}
            jobId={job?.id}
            onSelectStage={setCurrentStage}
            selectedStage={currentStage}
            job={job}
            candidate={candidate}
            refetch={refetchTimeline}
            currentStage={currentStage}
            stageId={instanceId}
            isPolling={isPolling}
            fetchHistory={fetchHistory}
            setIsPolling={setIsPolling}
            setIsJobModalOpen={setIsJobModalOpen}
            onTranscriptDisableChange={setIsTranscriptDisabled}
          />
          {/* <StageControls
            stages={stages}
            currentStage={currentStage}
            onStageChange={setCurrentStage}
            isLoadingStages={isLoadingStages}
            stageId={stageId}
            job={job}
            isUploaded={isPolling}
            onSuccess={() => {
              setIsPolling(true);
              fetchHistory();
            }}
          /> */}

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto pt-2 space-y-2 ">

            {isResumeScreening ? (
              candidateData ? (
                <div className="mx-auto">
                  <div className="flex justify-end px-4 mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDetailsModalOpen(true)}
                      className="rounded-xl border-primary/20 hover:bg-primary/5 font-bold"
                    >
                      <Info className="h-4 w-4 mr-2" />
                      Show More
                    </Button>
                  </div>
                  <AnalysisContent
                    candidate={candidateData}
                    showAllSkills={showAllSkills}
                    setShowAllSkills={setShowAllSkills}
                    jobId={job?.id}
                  >
                    {latestDecision && latestDecision.decision.toLowerCase() !== "may be" && (
                      <HrDecision decision={latestDecision} />
                    )}
                    <DecisionHistory decisions={filteredHistory} />
                  </AnalysisContent>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground font-bold">Loading candidate details...</p>
                </div>
              )
            ) : isLoadingEvaluation ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-bold">Fetching evaluation data...</p>
              </div>
            ) : isPolling ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-primary animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-black uppercase tracking-tight">AI Analysis in Progress</h3>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    We're analyzing the transcript and generating insights. This usually takes 90-120 seconds.
                  </p>
                </div>
              </div>
            ) : evaluation ? (
              <>
                <div className="flex items-center justify-end px-4 mb-2 gap-3">
                  <Button
                    variant={"outline"}
                    onClick={() => window.scroll({
                      top: document.body.scrollHeight,
                      behavior: "smooth",
                    })}>Go to Actions</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsHistoryModalOpen(true)}
                    className="rounded-xl border-primary/20 hover:bg-primary/5 font-bold shadow-sm transition-all active:scale-95"
                  >
                    <History className="h-4 w-4 mr-2 text-primary" />
                    Evaluation History
                    <Badge variant="outline"> V{evaluationHistory.length - Math.max(0, evaluationHistory.findIndex(h => h.id === evaluation.id))}
                      {/* {evaluationHistory[0]?.id === evaluation.id && " (Latest)"} */}
                    </Badge>
                  </Button>
                </div>
                <EvaluationGrid
                  data={evaluation?.evaluation_data}
                />

                <div className="mx-auto space-y-1">
                  {/* Section 1: Overall Summary */}
                  {transformedOverall && <StageOverallSummary data={transformedOverall} />}

                  {/* Section 2: Histories Grid */}

                  <CandidateHistoryGrid
                    hrDecisionHistory={hrDecisionHistory}
                    transcriptHistory={transcriptHistory}
                    onTranscriptClick={(id) => navigate(`./transcript`, {
                      state: { transcriptId: id, candidateName },
                      relative: "path"
                    })}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">No Evaluation Data</h3>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    {error ? error : "Upload a transcript to generate an AI evaluation for this stage."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Action Bar */}
          {!isLoadingEvaluation && !isSubmitting && !isPolling && !isLoadingHistory && canTakeDecision && (isResumeScreening ? !!candidateData : !!evaluation) && (
            <PermissionGuard permissions={PERMISSIONS.CANDIDATES_DECIDE} hideWhenDenied>
              <ActionButtons
                onAction={handleAction}
                showMaybeButton={!latestDecision || latestDecision.decision.toLowerCase() !== "may be"}
                className="rounded-2xl bg-none"
              />
            </PermissionGuard>
          )}
        </div>
      </div>

      <FeedbackDialog
        isOpen={showFeedbackModal}
        onOpenChange={setShowFeedbackModal}
        form={form}
        onSubmit={submitFeedback}
        candidateName={candidateName}
        isSubmitting={isSubmitting}
      />
      <JobInfoModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        job={job}
      />
      {candidateData && (
        <CandidateDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          candidate={candidateData}
          jobId={job?.id}
          onDecisionSubmitted={() => {
            fetchHrDecisionHistory();
            setRefetchTimeline(prev => prev + 1);
          }}
        />
      )}
      <EvaluationHistoryModal
        isOpen={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
        history={evaluationHistory}
        isLoading={isLoadingHistory}
        onSelectVersion={handleSelectHistoryVersion}
        currentVersionId={evaluation?.id}
      />
    </AppPageShell>
  );
}

