/**
 * @module CandidatesStages
 * @component CandidatesStages
 *
 * Dashboard view mapping candidate progression across different pipeline stages.
 */
import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import AppPageShell from "@/components/shared/AppPageShell";
import { ActionButtons } from "@/components/modal/candidate-details/ActionButtons";
import { FeedbackDialog } from "@/components/modal/candidate-details/FeedbackDialog";
import { StageCandidatesHeader } from "@/components/candidate/StageCandidatesHeader";
import { EvaluationHistoryModal } from "@/components/modal/candidate-details/EvaluationHistoryModal";
import { CandidateTimeline } from "@/components/candidate/CandidateTimeline";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { CandidateDetailsModal } from "@/components/modal/CandidateDetailsModal";
import { ResumeScreeningView } from "@/components/candidate/ResumeScreeningView";
import { StageEvaluationView, getChartData } from "@/components/candidate/StageEvaluationView";
import { PollingState, EmptyState, SubmittedState } from "@/components/candidate/StageStateViews";
import { useCandidatesStages } from "@/hooks/useCandidatesStages";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { JobInfoModal } from "@/components/modal/JobInfoModal";

const JobCandidatesBarChart = lazy(() => import("@/components/job/candidates/JobCandidatesBarChart"))

/**
 * The main page component for viewing and managing a candidate's progress through interview stages.
 * Orchestrates the display of resume screening, interview evaluations, and action buttons
 * for HR decisions. It uses the `useCandidatesStages` hook to manage its internal state.
 */
export default function CandidatesStages() {
  const navigate = useNavigate();
  const {
    job,
    candidate,
    candidateName,
    currentStage,
    setCurrentStage,
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
    isDetailsModalOpen,
    setIsDetailsModalOpen,
    evaluationHistory,
    isLoadingHistory,
    isHistoryModalOpen,
    setIsHistoryModalOpen,
    isTranscriptDisabled,
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
    handlePaperChange,
    setRefetchTimeline,
    isFailedEvaluation,
    isSubmittedEvaluation,
    handleRetry,
    isRetrying,
    handleEvaluateGithub,
    isEvaluatingGithub,
    associateResults,
    isLoadingAssociateResults,
    hasPendingAssociates,
    requiredInputs,
    stageStatus,
    githubUrl,
  } = useCandidatesStages();

  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    setShowChart(false);
  }, [currentStage, candidate?.id]);

  const isResumeScreening = currentStage === "Resume Screening";

  const chartData = evaluation?.evaluation_data ? getChartData(evaluation.evaluation_data) : [];

  return (
    <AppPageShell width="full" className="p-0 overflow-hidden bg-background">
      <StageCandidatesHeader
        job={job || null}
        candidateName={candidateName}
        onBack={() => navigate(-1)}
        onInfoClick={() => setIsJobModalOpen(true)}
        onResumeClick={() => setIsDetailsModalOpen(true)}
        isUploaded={isTranscriptDisabled}
        onSuccess={() => {
          setIsPolling(true);
          fetchHistory();
        }}
        onPaperChange={handlePaperChange}
        stageId={instanceId as string}
        candidateId={candidate?.id}
        stageName={currentStage}
        githubUrl={githubUrl}
        transcriptHistory={transcriptHistory}
        hasError={!!error}
        stageStatus={stageStatus}
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
            job={job || undefined}
            candidate={candidate || undefined}
            currentStage={currentStage}
            stageId={instanceId}
          />

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto pt-2 space-y-2 ">
            {isResumeScreening ? (
              candidateData ? (
                <ResumeScreeningView
                  candidateData={candidateData}
                  showAllSkills={showAllSkills}
                  setShowAllSkills={setShowAllSkills}
                  jobId={job?.id}
                  latestDecision={latestDecision}
                  filteredHistory={filteredHistory}
                  onShowMoreClick={() => setIsDetailsModalOpen(true)}
                />
              ) : (
                <LoadingSpinner message="Loading candidate details..." />
              )
            ) : isLoadingEvaluation && !isPolling ? (
              <LoadingSpinner message="Fetching evaluation data..." />
            ) : isPolling ? (
              <PollingState />
            ) : isSubmittedEvaluation ? (
              <SubmittedState
                githubUrl={githubUrl}
                onEvaluate={handleEvaluateGithub}
                isEvaluating={isEvaluatingGithub}
              />
            ) : evaluation ? (
              <>
                <StageEvaluationView
                  evaluation={evaluation}
                  candidate={candidate}
                  evaluationHistory={evaluationHistory}
                  onOpenHistory={() => setIsHistoryModalOpen(true)}
                  transformedOverall={transformedOverall}
                  hrDecisionHistory={hrDecisionHistory}
                  transcriptHistory={transcriptHistory}
                  onTranscriptClick={(id) =>
                    navigate(`./transcript`, {
                      state: { transcriptId: id, candidateName },
                      relative: "path",
                    })
                  }
                  candidateId={candidate?.id}
                  githubUrl={githubUrl}
                  job={job || null}
                  onPaperChange={handlePaperChange}
                  stageName={currentStage}
                  candidateName={candidateName}
                  requiredInputs={requiredInputs}
                  showChart={showChart}
                  onShowChartChange={setShowChart}
                />
                {showChart && (
                  <Suspense fallback={<LoadingSpinner message="Loading charts..." fullPage={true} />}>
                    <div className="w-full flex justify-center bg-card/30 p-3 rounded-2xl border border-border/50 animate-in fade-in duration-300">
                      <div className="w-full min-h-25 max-h-75">
                        <JobCandidatesBarChart data={chartData.length > 0 ? chartData : undefined} />
                      </div>
                    </div>
                  </Suspense>
                )}
              </>
            ) : (
              <EmptyState
                error={error}
                isFailed={isFailedEvaluation}
                onRetry={handleRetry}
                isRetrying={isRetrying}
              />
            )}

          </div>

          {/* Footer Action Bar */}
          {!isLoadingEvaluation &&
            !isSubmitting &&
            !isPolling &&
            !isLoadingHistory &&
            canTakeDecision &&
            !showChart &&
            (isResumeScreening ? !!candidateData : !!evaluation) && (
              <PermissionGuard permissions={PERMISSIONS.CANDIDATES_DECIDE} hideWhenDenied>
                <ActionButtons
                  onAction={handleAction}
                  showMaybeButton={!latestDecision || latestDecision.decision.toLowerCase() !== "may be"}
                  className="rounded-2xl bg-none"
                  disabled={isLoadingAssociateResults || hasPendingAssociates}
                  associateResults={associateResults}
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
        job={job || null}
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
