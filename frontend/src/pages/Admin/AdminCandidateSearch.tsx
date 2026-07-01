/**
 * @module AdminCandidateSearch
 * @component AdminCandidateSearch
 *
 * Admin page for searching candidates globally or for a specific job.
 * Provides advanced search and filtering for HR.
 */
import { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import type { JobRead } from "@/types/admin";
import type { CandidateResponse } from "@/types/resume";
import AppPageShell from "@/components/shared/AppPageShell";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import PageHeader from "@/components/shared/PageHeader";
import JobSummaryCard from "@/components/shared/JobSummaryCard";
import CandidateSearchTable from "@/components/candidate/CandidateSearchTable";
import QuickResumeUpload from "@/components/candidate/QuickResumeUpload";

import { JobCandidatesSkeleton } from "@/components/job/candidates/JobCandidatesSkeleton";
import type { PaginationState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import type { CandidateActiveFilters } from "@/hooks/useCandidateTableFilters";
import { usePageFilters } from "@/hooks/usePageFilters";
import { useToast } from "@/components/shared/ToastProvider";

import { useDeleteResumeMutation } from "@/hooks/mutations/jobs/useResumeMutation";
import type { DateRange } from "react-day-picker";
import { useDeleteConfirmation } from "@/hooks/useDeleteConfirmation";
import { CandidateDetailsModal } from "@/components/modal/CandidateDetailsModal";
import DeleteModal from "@/components/modal/DeleteModal";
import { useAdminCandidates } from "@/hooks/queries/jobs/useAdminCandidates";
import { useJob } from "@/hooks/queries/jobs/useJob";


export default function AdminCandidateSearch() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith("/dashboard/admin");
  const toast = useToast();

  const { filters, setFilters } = usePageFilters(`adminCandidateSearch_${jobId || "global"}`, {
    pageIndex: 0,
    pageSize: 10,
    job: [] as string[],
    status: [] as string[],
    city: [] as string[],
    hr_decision: [] as string[],
    hr_score: [] as number[],
    dateRange: undefined as DateRange | null | undefined,
    result: [] as string[],
    stage_id: [] as string[],
    activity_session: [] as string[],
    q: "",
    test_email_sent: undefined as boolean | undefined,
  });
  const { pageIndex, pageSize } = filters;

  const pagination = useMemo(() => ({ pageIndex, pageSize }), [pageIndex, pageSize]);

  const setPagination = (val: PaginationState | ((prev: PaginationState) => PaginationState)) => {
    const currentPagination = { pageIndex: filters.pageIndex, pageSize: filters.pageSize };
    const nextPagination = typeof val === "function" ? val(currentPagination) : val;
    setFilters({
      pageIndex: nextPagination.pageIndex,
      pageSize: nextPagination.pageSize,
    });
  };

  const [job, setJob] = useState<JobRead | null>(null);

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Detail Modal State
  const [showDetail, setShowDetail] = useState(false);
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateResponse | null>(null);

  const handleSetFilters = useCallback((partial: Partial<CandidateActiveFilters>) => {
    setFilters({
      ...partial,
      pageIndex: 0,
    });
  }, [setFilters]);

  const {
    data: candidates,
    total,
    loading,
    error: queryError,
    refetch: fetchCandidates,
  } = useAdminCandidates(
    jobId,
    pageIndex * pageSize,
    pageSize,
    filters
  );

  const error = queryError ? queryError.message : null;

  useEffect(() => {
    if (!loading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [loading, isInitialLoad]);

  const { data: jobData } = useJob(jobId);

  useEffect(() => {
    if (jobData) {
      setJob(jobData as unknown as JobRead);
    }
  }, [jobData]);

  const handleShowMore = (candidate: CandidateResponse) => {
    setSelectedCandidate(candidate);
    setShowDetail(true);
  };

  // const handleShowAnalysisDetails = (candidate: CandidateResponse) => {
  //   setSelectedCandidate(candidate);
  //   setSelectedResumeId(candidate.resume_id || null);
  //   setShowAnalysisDetails(true);
  // };
  const { mutateAsync: deleteResume } = useDeleteResumeMutation();
  const {
    showModal: showDeleteModal,
    handleDeleteClick,
    handleClose: handleCloseDelete,
    handleConfirm: handleConfirmDelete,
    isDeleting,
    error: deleteError,
  } = useDeleteConfirmation<CandidateResponse>({
    deleteFn: async (id) => {
      const candidate = candidates.find((c) => c.id === id);

      if (!candidate?.resume_id || !candidate.applied_job_id) {
        throw new Error("Cannot delete: Missing job context or resume ID.");
      }
      await deleteResume({ jobId: candidate.applied_job_id, resumeId: candidate.resume_id });
    },
    onSuccess: () => {
      fetchCandidates();
      toast.success("Candidate deleted successfully");
    },
    itemTitle: (c) => `${c.first_name} ${c.last_name}`,
  });

  return (
    <AppPageShell width="wide" gap="tight">
      <PageHeader
        title={jobId ? `Candidates for ${job?.title || "Job"}` : "Candidate Search"}
        actions={
          jobId && (
            <>
              <QuickResumeUpload
                jobId={jobId}
                jobTitle={job?.title}
                onSuccess={fetchCandidates}
                variant="default"
              />
              <Button
                variant="secondary"
                onClick={() =>
                  navigate(
                    isAdminPath ? "/dashboard/admin/jobs" : "/dashboard/jobs",
                  )
                }
              >
                Back to Jobs
              </Button>
            </>
          )
        }
      />

      {job && <JobSummaryCard job={job} />}

      {error ? (
        <ErrorDisplay message={error} onRetry={fetchCandidates} />
      ) : isInitialLoad ? (
        <div className="mt-6">
          <JobCandidatesSkeleton count={pagination.pageSize} />
        </div>
      ) : (
        // <div className={loading ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
        <CandidateSearchTable
          candidates={candidates}
          total={total}
          pagination={pagination}
          onPaginationChange={setPagination}
          onShowMore={handleShowMore}
          showJobContext={!jobId}
          filters={filters}
          setFilters={handleSetFilters}
          // onShowAnalysisDetails={handleShowAnalysisDetails}
          onDelete={handleDeleteClick}
        />
        // </div>
      )}

      {/* Candidate Detail Modal */}
      <CandidateDetailsModal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        candidate={selectedCandidate}
        jobId={jobId}
      />

      <DeleteModal
        show={showDeleteModal}
        handleClose={handleCloseDelete}
        handleConfirm={handleConfirmDelete}
        title="Delete Candidate"
        message={`Are you sure you want to delete this candidate? This action cannot be undone.`}
        isLoading={isDeleting}
        error={deleteError}
      />
    </AppPageShell>
  );
};
