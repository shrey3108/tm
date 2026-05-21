import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Input } from "@/components/";
import { RotateCw, Layers } from "lucide-react";
import { CandidateDetailsModal, JobInfoModal, DeleteModal } from "@/components/modal";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import CandidateTable from "@/components/candidate/CandidateTable";
import { useJobCandidates } from "@/hooks/useJobCandidates";
import { JobCandidatesSkeleton } from "@/components/candidate/JobCandidatesSkeleton";
import { JobCandidatesHeader } from "@/components/candidate/JobCandidatesHeader";
import { JobCandidatesCharts } from "@/components/candidate/JobCandidatesCharts";
import { JobCandidatesStats } from "@/components/candidate/JobCandidatesStats";
import PermissionGuard from "@/components/auth/PermissionGuard";
import type { CandidateAnalysis } from "@/types/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import { PERMISSIONS } from "@/lib/permissions";
import type { PaginationState } from "@tanstack/react-table";
import type { CandidateActiveFilters } from "@/hooks/useCandidateTableFilters";
import { slugify } from "@/utils/slug";
import type { DateRange } from "react-day-picker";

/**
 * Page component for managing job candidates with toggle between candidates list and analytics views.
 * Provides candidate table with filtering, search, and bulk reanalyze functionality.
 */
export default function JobCandidates() {
  const { jobSlug } = useParams<{ jobSlug: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<"candidates" | "analytics">("candidates");

  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });


  const [activeFilters, setActiveFilters] = useState<CandidateActiveFilters>(() => {
    const params = new URLSearchParams(window.location.search);
    const startDate = params.get("start_date");
    const endDate = params.get("end_date");
    return {
      status: [],
      city: [],
      job: [],
      hr_decision: [],
      hr_score: [],
      dateRange: (startDate || endDate)
        ? {
          from: startDate ? new Date(startDate) : undefined,
          to: endDate ? new Date(endDate) : undefined,
        }
        : undefined,
    };
  });

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
    query: activeFilters.q,
    hr_decision: activeFilters.hr_decision,
    start_date: activeFilters.dateRange?.from,
    end_date: activeFilters.dateRange?.to,
    activity_session: activeFilters.activity_session,
    stage_id: activeFilters.stage_id,
    city: activeFilters.city,
    result: activeFilters.result,
    hr_score: activeFilters.hr_score,
  });

  const [selectedCandidate, _setSelectedCandidate] = useState<CandidateAnalysis | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);

  const [modalInitialTab, _setModalInitialTab] = useState<"analysis" | "jd" | "cross-job-match">("analysis");
  const handleFiltersChange = (filters: CandidateActiveFilters) => {
    setActiveFilters(filters);
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  };

  const handleUploadClick = () => {
    if (!job?.is_active) return;
    fileInputRef.current?.click();
  };

  return (
    <AppPageShell width="wide" className="animate-in fade-in duration-500">

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
      />

      <div className="relative min-h-[400px]">
        {viewMode === "analytics" ? (
          /* Analytics View: Only Charts */
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <JobCandidatesCharts
              loading={loading}
              isRefreshing={isRefreshing}
              stats={stats}
              jobStats={jobStats}
            />
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
                      showLocationFilter={true}
                      showStatusFilter={true}
                      stageOptions={job?.stages?.map(s => s.template.name) || []}
                      pagination={{ pageIndex, pageSize }}
                      onPaginationChange={setPagination}
                      pageCount={Math.ceil(totalCandidates / pageSize)}
                      total={totalCandidates}
                      activitySessions={activitySession}
                      onFiltersChange={handleFiltersChange}
                      initialDateRange={activeFilters.dateRange as DateRange | undefined}
                      headerActions={
                        <PermissionGuard permissions={PERMISSIONS.JOBS_MANAGE} hideWhenDenied>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-amber-300 hover:bg-amber-500/10 text-amber-600 hover:text-amber-700 font-semibold transition-all flex items-center gap-2 h-10 rounded-xl"
                            onClick={handleReanalyzeAll}
                            disabled={candidates.filter(needsReanalysis).length === 0}
                            title={
                              candidates.filter(needsReanalysis).length === 0
                                ? "All candidates are analyzed with the latest JD version"
                                : `Re-analyze ${candidates.filter(needsReanalysis).length} candidate(s) that need it`
                            }
                          >
                            <RotateCw className="h-4 w-4" />
                            Reanalyze All
                          </Button>
                        </PermissionGuard>
                      }
                      renderActions={(candidate) => (
                        <div className="flex items-center gap-2 justify-end">
                          <PermissionGuard permissions={PERMISSIONS.JOBS_MANAGE} hideWhenDenied>
                            <HoverCard>
                              <HoverCardTrigger
                                render={(props) => (
                                  <Button
                                    {...props}
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 p-0 rounded-xl border border-amber-300 hover:bg-amber-500/10 transition-all duration-300 flex items-center justify-center shrink-0"
                                    onClick={(e) => {
                                      if (props.onClick) props.onClick(e);
                                      handleReanalyzeCandidate(candidate.id);
                                    }}
                                    isLoading={reanalyzingCandidateIds.includes(candidate.id)}
                                    disabled={
                                      !needsReanalysis(candidate) ||
                                      reanalyzingCandidateIds.includes(candidate.id)
                                    }
                                    title={
                                      !needsReanalysis(candidate)
                                        ? "Already analyzed with the latest JD version"
                                        : "Re-analyze with the latest JD version"
                                    }
                                  >
                                    <RotateCw className="h-4 w-4 text-amber-600 shrink-0" />
                                  </Button>
                                )}
                              />
                              <HoverCardContent side="top" className="w-auto p-2 min-w-0">
                                <div className="text-sm font-semibold text-amber-700">Reanalyze</div>
                              </HoverCardContent>
                            </HoverCard>
                          </PermissionGuard>
                          {/* <HoverCard>
                            <HoverCardTrigger
                              render={(props) => (
                                <Button
                                  {...props}
                                  variant="secondary"
                                  size="sm"
                                  className="h-9 w-9 p-0 rounded-xl bg-muted/50 hover:bg-muted text-foreground transition-all duration-300 border border-muted-foreground/10 flex items-center justify-center shrink-0"
                                  onClick={(e) => {
                                    if (props.onClick) props.onClick(e);
                                    setSelectedCandidate(candidate);
                                    setModalInitialTab("analysis");
                                    setIsModalOpen(true);
                                  }}
                                >
                                  <Info className="h-4 w-4 shrink-0" />
                                </Button>
                              )}
                            />
                            <HoverCardContent side="top" className="w-auto p-2 min-w-0">
                              <div className="text-sm font-semibold">More Info</div>
                            </HoverCardContent>
                          </HoverCard> */}
                          <HoverCard>
                            <HoverCardTrigger
                              render={(props) => (
                                <Button
                                  {...props}
                                  variant="secondary"
                                  size="sm"
                                  className="h-9 w-9 p-0 rounded-xl bg-muted/50 hover:bg-muted text-foreground transition-all duration-300 border border-muted-foreground/10 flex items-center justify-center shrink-0 "
                                  onClick={() => {
                                    const candidateFullName = slugify(`${candidate.first_name} ${candidate.last_name}`);
                                    const stageSlug = slugify("Resume Screening");

                                    navigate(`/dashboard/jobs/${jobSlug}/candidates/${candidateFullName}/stages/${stageSlug}`, {
                                      state: {
                                        candidate: candidate,
                                        jobSlug: jobSlug,
                                        job
                                      }
                                    })
                                  }}
                                  disabled={!candidate.pipeline}
                                >
                                  <Layers className="h-4 w-4 shrink-0 text-blue-600" />
                                </Button>
                              )}
                            />
                            <HoverCardContent side="top" className="w-auto p-2 min-w-0">
                              <div className="text-sm font-semibold text-blue-600">Stages</div>
                            </HoverCardContent>
                          </HoverCard>
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

                            <HoverCardContent side="top" className="w-auto p-2 min-w-0">
                              <div className="text-sm font-semibold">Delete</div>
                            </HoverCardContent>
                          </HoverCard> */}
                        </div>
                      )}
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
    </AppPageShell>
  );
}
