/**
 * @module JobCandidates
 * @component JobCandidates
 *
 * Detailed view listing candidates applied to a specific job, with stage details.
 */
import { useState, useRef, useMemo, useEffect, lazy, Suspense, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RotateCw } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import CandidateTable from "@/components/candidate/CandidateTable";
import { useJobCandidates } from "@/hooks/useJobCandidates";
import { usePageFilters } from "@/hooks/usePageFilters";
import { JobCandidatesSkeleton } from "@/components/job/candidates/JobCandidatesSkeleton";
import { JobCandidatesHeader } from "@/components/job/candidates/JobCandidatesHeader";
import { JobCandidatesStats } from "@/components/job/candidates/JobCandidatesStats";
import PermissionGuard from "@/components/auth/PermissionGuard";
import type { CandidateAnalysis } from "@/types/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import { PERMISSIONS } from "@/lib/permissions";
import type { PaginationState } from "@tanstack/react-table";
import type { CandidateActiveFilters } from "@/hooks/useCandidateTableFilters";
import { slugify } from "@/utils/slug";
import type { DateRange } from "react-day-picker";
import { useCandidatesTestPapers } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import { Button } from "@/components/ui/button";
import { CandidateDetailsModal } from "@/components/modal/CandidateDetailsModal";
import { JobInfoModal } from "@/components/modal/JobInfoModal";
import { Input } from "@/components/ui/input";
import DeleteModal from "@/components/modal/DeleteModal";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { CandidateAssignPaperButton } from "@/components/shared/candidate/CandidateAssignPaperButton";
import { ProjectSubmissionDialog } from "@/components/candidate/projectSubmission/ProjectSubmissionDialog";
import { useJobAssignedTask } from "@/hooks/queries/jobs/useJobTask";
import { CandidateProjectSubmissionButton } from "@/components/job/candidates/columns/CandidateProjectSubmissionButton";
import { CandidateStagesButton } from "@/components/job/candidates/columns/CandidateStagesButton";
import { CandidateOverviewButton } from "@/components/job/candidates/columns/CandidateOverviewButton";

const JobCandidatesCharts = lazy(() =>
  import("@/components/job/candidates/JobCandidatesCharts").then((m) => ({ default: m.JobCandidatesCharts }))
);

/**
 * Page component for managing job candidates with toggle between candidates list and analytics views.
 * Provides candidate table with filtering, search, and bulk reanalyze functionality.
 */
export default function JobCandidates() {
  const { jobSlug } = useParams<{ jobSlug: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<"candidates" | "analytics">("candidates");

  const urlFilters = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const startDate = params.get("start_date");
    const endDate = params.get("end_date");
    return {
      pageIndex: 0,
      pageSize: 10,
      status: [] as string[],
      city: [] as string[],
      job: [] as string[],
      hr_decision: [] as string[],
      hr_score: [] as number[],
      dateRange: (startDate || endDate)
        ? {
          from: startDate ? new Date(startDate) : undefined,
          to: endDate ? new Date(endDate) : undefined,
        } as DateRange
        : undefined as DateRange | null | undefined,
      q: "",
      activity_session: [] as string[],
      stage_id: [] as string[],
      result: [] as string[],
      test_email_sent: undefined as boolean | undefined,
    };
  }, []);

  const { filters, setFilters } = usePageFilters(`jobCandidates_${jobSlug}`, urlFilters);
  const { pageIndex, pageSize } = filters;

  const setPagination = (val: PaginationState | ((prev: PaginationState) => PaginationState)) => {
    const currentPagination = { pageIndex: filters.pageIndex, pageSize: filters.pageSize };
    const nextPagination = typeof val === "function" ? val(currentPagination) : val;
    setFilters({
      pageIndex: nextPagination.pageIndex,
      pageSize: nextPagination.pageSize,
    });
  };

  const {
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
    stats,
    jdVersion,
    setJdVersion,
    totalCandidates,
    // handleDeleteClick,
    showDeleteModal,
    handleCloseDelete,
    handleConfirmDelete,
    isDeleting,
    deleteError,
    deleteMessage,
    jobStats,
    activitySession
  } = useJobCandidates(jobSlug, pageIndex, pageSize, {
    query: filters.q,
    hr_decision: filters.hr_decision,
    start_date: filters.dateRange?.from,
    end_date: filters.dateRange?.to,
    activity_session: filters.activity_session,
    stage_id: filters.stage_id,
    city: filters.city,
    result: filters.result,
    hr_score: filters.hr_score,
    test_email_sent: filters.test_email_sent,
  });

  const [selectedCandidate, setSelectedCandidate] = useState<CandidateAnalysis | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isProjectSubmissionOpen, setIsProjectSubmissionOpen] = useState(false);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});


  // Reset rowSelection when filters or pagination changes
  useEffect(() => {
    setRowSelection({});
  }, [pageIndex, pageSize, filters]);

  // Compute showCheckboxes: Only display after round is Coding Test / Technical Practical Round and decision is pending
  const showCheckboxes = useMemo(() => {
    const selectedStageConfigs = job?.stages?.filter((s) => filters.stage_id?.includes(s.id)) || [];
    const hasTechnicalPracticalRoundSelected = selectedStageConfigs.some(
      (s) => s.template?.name === "Technical Practical Round" || s.template?.name === "Coding Test Round"
    );
    const isHrDecisionPendingSelected = filters.hr_decision?.includes("pending");
    return !!(hasTechnicalPracticalRoundSelected && isHrDecisionPendingSelected);
  }, [job?.stages, filters.stage_id, filters.hr_decision]);

  // Compute selected candidates
  const selectedCandidates = useMemo(() => {
    return Object.keys(rowSelection).flatMap((key) => {
      if (!rowSelection[key]) return [];
      const candidate = candidates[Number(key)];
      return candidate ? [candidate] : [];
    });
  }, [rowSelection, candidates]);

  // Compute emailFilterState from filters.test_email_sent
  const emailFilterState = useMemo(() => {
    if (filters.test_email_sent === true) return "sent" as const;
    if (filters.test_email_sent === false) return "not_sent" as const;
    return undefined;
  }, [filters.test_email_sent]);

  const selectedCandidateIds = useMemo(() => {
    return selectedCandidates.map((c) => c.id);
  }, [selectedCandidates]);

  const { data: selectedCandidatesTestPapers, loading: loadingTestPapers } = useCandidatesTestPapers(selectedCandidateIds);
  const { data: jobAssignedPaper } = useJobAssignedTask(job?.id);

  // Derive button state from selected candidates' actual data
  // task_file_path: null → no paper assigned, non-null → paper assigned
  // test_email_sent: true → email sent, false/undefined → not sent
  const resolvedEmailState = useMemo((): "sent" | "not_sent" | undefined => {
    // If candidates are selected, their actual data takes precedence
    if (selectedCandidates.length > 0) {
      if (loadingTestPapers) return undefined;

      const allHavePaper = selectedCandidatesTestPapers.length > 0 && selectedCandidatesTestPapers.every((paper) => !!paper);
      if (!allHavePaper) return undefined; // No paper → "Assign Question Paper"

      // All have paper — check email status
      const allSent = selectedCandidatesTestPapers.every((paper) => paper && paper.email_sent_count && paper.email_sent_count > 0);
      if (allSent) return "sent" as const;

      return "not_sent" as const;
    }

    // Fallback: If no candidates are selected, but explicit filter is set, use the filter state
    if (emailFilterState !== undefined) return emailFilterState;

    return undefined;
  }, [emailFilterState, selectedCandidates, selectedCandidatesTestPapers, loadingTestPapers]);

  const [modalInitialTab, _setModalInitialTab] = useState<"analysis" | "jd" | "cross-job-match">("analysis");
  const handleSetFilters = useCallback((partial: Partial<CandidateActiveFilters>) => {
    setFilters({
      ...partial,
      pageIndex: 0,
    });
  }, [setFilters]);

  const handleUploadClick = () => {
    if (!job?.is_active) return;
    fileInputRef.current?.click();
  };

  const navigateToAssignPage = () => {
    const jobSlug = slugify(job?.title);
    if (jobAssignedPaper) {
      return navigate(`/dashboard/jobs/${jobSlug}/send-paper`, {
        state: {
          selectedCandidates,
          job,
          emailFilterState: resolvedEmailState
        }
      });
    }
    navigate(`/dashboard/jobs/${jobSlug}/assign-paper`, {
      state: {
        selectedCandidates,
        job,
        emailFilterState: resolvedEmailState
      }
    });
  };

  return (
    <AppPageShell width="wide">

      <JobCandidatesHeader
        job={job}
        onBack={() => navigate("/dashboard/jobs")}
        onInfoClick={() => setIsJobModalOpen(true)}
        onUploadClick={handleUploadClick}
        onToggleStatus={handleToggleStatus}
        isUploading={isUploading}
        jdVersion={jdVersion}
        setJdVersion={setJdVersion}
        viewMode={viewMode}
        setViewMode={setViewMode}
        showSendQuestionPaper={true}
        onSendQuestionPaperClick={navigateToAssignPage}
        emailFilterState={selectedCandidates.length > 0 ? resolvedEmailState : undefined}
      />

      <div className="relative min-h-[400px]">
        {viewMode === "analytics" ? (
          /* Analytics View: Only Charts */
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <Suspense fallback={
              <LoadingSpinner message="Loading charts..." fullPage={true} />
            }>
              <JobCandidatesCharts
                loading={loading}
                isRefreshing={isRefreshing}
                stats={stats}
                jobStats={jobStats}
              />
            </Suspense>
          </div>
        ) : (
          /* Candidates View: Stats Cards + Table */
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
            {/* Stats Section */}
            <div className="animate-in fade-in duration-700">
              {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-28 rounded-[2.5rem] bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : (
                <JobCandidatesStats
                  totalCandidates={stats.totalCandidates}
                  passedCount={stats.passedCount}
                  failedCount={stats.failedCount}
                  maybeCount={stats.maybeCount}
                  undecidedCount={stats.undecidedCount}
                />
              )}
            </div>

            {/* Candidate List Section */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xl font-bold text-foreground">Candidate Pool</h2>
              </div>
              <div className=" p-0 overflow-hidden border-muted-foreground/10 ">
                {loading ? (
                  <div className="p-4">
                    <JobCandidatesSkeleton count={5} />
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-5 duration-1000 relative">
                    <CandidateTable
                      emptyMessage="No candidates found for this job."
                      candidates={candidates}
                      passing_threshold={job?.passing_threshold}
                      isServerSide={true}
                      job={job}
                      showLocationFilter={true}
                      showStatusFilter={true}
                      stageOptions={job?.stages?.map(s => ({ id: s.id, name: s.template.name })) || []}
                      pagination={{ pageIndex, pageSize }}
                      onPaginationChange={setPagination}
                      pageCount={Math.ceil(totalCandidates / pageSize)}
                      total={totalCandidates}
                      activitySessions={activitySession}
                      filters={filters}
                      setFilters={handleSetFilters}
                      rowSelection={rowSelection}
                      onRowSelectionChange={setRowSelection}
                      showCheckboxes={showCheckboxes}
                      headerActions={
                        <PermissionGuard permissions={PERMISSIONS.JOBS_MANAGE} hideWhenDenied>
                          <HoverCard>
                            <HoverCardTrigger
                              render={(props) => (
                                <Button
                                  {...props}
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 px-3 rounded-xl border hover:bg-gray-200/60 flex items-center justify-center gap-2 shrink-0 font-semibold transition-all"
                                  onClick={handleReanalyzeAll}
                                  disabled={candidates.filter(needsReanalysis).length === 0}
                                >
                                  <RotateCw className="h-4 w-4 shrink-0" />
                                </Button>
                              )}
                            />
                            <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-normal" side="top">
                              {candidates.filter(needsReanalysis).length === 0
                                ? "All candidates are analyzed with the latest JD version"
                                : `Re-analyze ${candidates.filter(needsReanalysis).length} candidate(s) that need it`}
                            </HoverCardContent>
                          </HoverCard>
                        </PermissionGuard>
                      }
                      renderActions={(candidate) => {
                        return (
                          <div className="flex items-center gap-0.5 justify-end">
                            <PermissionGuard permissions={PERMISSIONS.JOBS_MANAGE} hideWhenDenied>
                              <HoverCard>
                                <HoverCardTrigger
                                  render={(props) => (
                                    <Button
                                      {...props}
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 rounded-xl border hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                                      onClick={(e) => {
                                        if (props.onClick) props.onClick(e);
                                        handleReanalyzeCandidate(candidate.id);
                                      }}
                                      isLoading={reanalyzingCandidateIds.includes(candidate.id)}
                                      disabled={
                                        !needsReanalysis(candidate) ||
                                        reanalyzingCandidateIds.includes(candidate.id) ||
                                        !candidate.is_parsed
                                      }
                                    >
                                      <RotateCw className="h-4 w-4  shrink-0" />
                                    </Button>
                                  )}
                                />
                                <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                                  Reanalyze
                                </HoverCardContent>
                              </HoverCard>
                            </PermissionGuard>
                            <CandidateAssignPaperButton candidate={candidate}
                              jobSlug={jobSlug}
                              job={job}
                              buttonClassName="h-7 w-7 p-0 rounded-xl bg-muted/50 hover:bg-gray-200/60 text-foreground border border-muted-foreground/10 flex items-center justify-center shrink-0"
                            />
                            <CandidateStagesButton
                              candidate={candidate}
                              jobSlug={jobSlug}
                              job={job}
                            />
                            <CandidateProjectSubmissionButton candidate={candidate} onClick={() => {
                              setSelectedCandidate(candidate);
                              setIsProjectSubmissionOpen(true);
                            }} />
                            <CandidateOverviewButton candidate={candidate} jobSlug={jobSlug} />
                            {/* <HoverCard>
                              <HoverCardTrigger
                                render={(props) => (
                                  <Button
                                    {...props}
                                    variant="outline"
                                    size="sm"
                                    className="h-9 w-9 p-0 rounded-xl bg-muted/50 hover:bg-muted text-foreground transition-all duration-300 border border-muted-foreground/10 flex items-center justify-center shrink-0"
                                    onClick={() => {
                                      setSelectedCandidate(candidate);
                                      handleDeleteClick(candidate);
                                    }}
                                  >
                                    <Trash className="h-4 w-4 shrink-0" />
                                  </Button>
                                )} />

                                  <HoverCardContent className="w-fit px-3 py-1.5 text-xs " side="top">
                                <div className="">Delete</div>
                              </HoverCardContent>
                            </HoverCard> */}
                          </div>
                        );
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>


      <CandidateDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        candidate={selectedCandidate}
        jobId={job?.id}
        onDecisionSubmitted={() => fetchData()}
        initialTab={modalInitialTab}
        passing_threshold={job?.passing_threshold}
      />

      <JobInfoModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        job={job}
      />

      <PermissionGuard permissions={PERMISSIONS.CANDIDATES_ACCESS} hideWhenDenied>
        <Input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept=".pdf,.doc,.docx"
          onChange={handleFileChange}
        />
      </PermissionGuard>
      <DeleteModal
        show={showDeleteModal}
        handleClose={handleCloseDelete}
        handleConfirm={handleConfirmDelete}
        title="Delete Candidate"
        message={deleteMessage}
        isLoading={isDeleting}
        error={deleteError}
      />
      <ProjectSubmissionDialog
        isOpen={isProjectSubmissionOpen}
        onOpenChange={setIsProjectSubmissionOpen}
        candidateName={selectedCandidate ? `${selectedCandidate.first_name || ""} ${selectedCandidate.last_name || ""}`.trim() : ""}
        candidateId={selectedCandidate?.id}
        stageId={selectedCandidate?.current_stage?.stage_id}
        job={job}
        onSuccess={() => fetchData()}
      />
    </AppPageShell>
  );
}
