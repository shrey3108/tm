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
import { StageEvaluationView } from "@/components/candidate/StageEvaluationView";
import { PollingState, EmptyState } from "@/components/candidate/StageStateViews";
import { useCandidatesStages } from "@/hooks/useCandidatesStages";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { JobInfoModal } from "@/components/modal/JobInfoModal";

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
    handlePaperChange,
    setRefetchTimeline,
    isFailedEvaluation,
    handleRetry,
    isRetrying,
  } = useCandidatesStages();

  const isResumeScreening = currentStage === "Resume Screening";

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
        githubUrl={candidateData?.task_file_path || candidate?.task_file_path}
        transcriptHistory={transcriptHistory}
        hasError={!!error}
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
            isPolling={isPolling}
            onTranscriptDisableChange={setIsTranscriptDisabled}
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
            ) : evaluation ? (
              <StageEvaluationView
                evaluation={evaluation}
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
                githubUrl={candidateData?.task_file_path || candidate?.task_file_path}
                job={job || null}
                onPaperChange={handlePaperChange}
                stageName={currentStage}
                candidateName={candidateName}
              />
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
            (isResumeScreening ? !!candidateData : !!evaluation)
            // TODO: REMOVE AFTER GEP
            &&
            // currentStage !== "Technical Practical Round" &&
            (
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


