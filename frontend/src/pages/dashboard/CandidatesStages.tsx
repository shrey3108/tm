/**
 * @module CandidatesStages
 * @component CandidatesStages
 *
 * Dashboard view mapping candidate progression across different pipeline stages.
 */
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
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
const DbdCompareBarChart = lazy(() => import("@/components/job/candidates/DbdCompareBarChart"))

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
    isDbdEnabled,
  } = useCandidatesStages();

  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    setShowChart(false);
  }, [currentStage, candidate?.id]);

  const isResumeScreening = currentStage === "Resume Screening";


  const associateNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (associateResults?.reviews) {
      associateResults.reviews.forEach((r) => {
        map[r.associate_id] = r.associate_name;
      });
    }
    return map;
  }, [associateResults]);

  // Prepare base AI chart data
  const aiChartData = useMemo(() => {
    return evaluation?.evaluation_data ? getChartData(evaluation.evaluation_data) : [];
  }, [evaluation]);

  // Prepare combined AI & DBD chart data and associate list
  const { combinedChartData, dbdAssociates } = useMemo(() => {
    if (!evaluation) return { combinedChartData: [], dbdAssociates: [] };

    // Get base AI chart data // no need of ai data because dbd criteria != stage criteria
    // const baseData = evaluation.evaluation_data ? getChartData(evaluation.evaluation_data) : [];

    // Map base data to a record for easy lookups and updates
    const skillsMap: Record<string, any> = {};
    // baseData.forEach((point) => {
    //   skillsMap[point.name] = { ...point };
    // });

    const activeAssociates: { key: string; label: string }[] = [];

    // Combine with dbd_results if available
    if (evaluation.dbd_results && evaluation.dbd_results.length > 0) {
      evaluation.dbd_results.forEach((dbdRes, idx) => {
        if (dbdRes.status === "submitted" && dbdRes.dbd_scores) {
          const assocName = associateNameMap[dbdRes.associate_id] || `Associate ${idx + 1}`;
          const assocKey = `associate_${idx}`;
          activeAssociates.push({ key: assocKey, label: assocName });

          dbdRes.dbd_scores.forEach((scoreObj) => {
            const criterionName = scoreObj.name || scoreObj.criterion;
            if (!criterionName) return;

            const normalizedKey = criterionName.replace(/_/g, " ").toUpperCase();
            if (!skillsMap[normalizedKey]) {
              skillsMap[normalizedKey] = {
                name: normalizedKey,
                jd: 0,
                project: 0,
              };
            }
            skillsMap[normalizedKey][assocKey] = scoreObj.score ?? 0;
          });
        }
      });
    }

    const sortedData = Object.values(skillsMap).sort((a, b) => a.name.localeCompare(b.name));
    return { combinedChartData: sortedData, dbdAssociates: activeAssociates };
  }, [evaluation, associateNameMap]);

  return (
    <AppPageShell width="full">
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
      <div className="flex w-full min-w-0 overflow-hidden">
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
                  isDbdEnabled={isDbdEnabled}
                  dbdAssociates={dbdAssociates}
                />
                {showChart && (
                  <div className="w-full flex justify-center bg-card/30 p-4 sm:p-6 pb-4 rounded-2xl border border-border/50 animate-in fade-in duration-300">
                    <div className="w-full">
                      {isDbdEnabled ? (
                        <Suspense fallback={<LoadingSpinner message="Loading comparison chart..." fullPage={true} />}>
                          <DbdCompareBarChart
                            data={combinedChartData.length > 0 ? combinedChartData : undefined}
                            associates={dbdAssociates}
                          />
                        </Suspense>
                      ) : (
                        <Suspense fallback={<LoadingSpinner message="Loading skills chart..." fullPage={true} />}>
                          <JobCandidatesBarChart
                            data={aiChartData.length > 0 ? aiChartData : undefined}
                          />
                        </Suspense>
                      )}
                    </div>
                  </div>
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
          passing_threshold={job?.passing_threshold}
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
