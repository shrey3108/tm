/**
 * Admin page for searching candidates globally or for a specific job.
 * Provides advanced search and filtering for HR.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import type { JobRead } from "@/types/admin";
import type { CandidateResponse } from "@/types/resume";
import AppPageShell from "@/components/shared/AppPageShell";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import PageHeader from "@/components/shared/PageHeader";
import JobSummaryCard from "@/components/shared/JobSummaryCard";
import CandidateSearchTable from "@/components/candidate/CandidateSearchTable";
import QuickResumeUpload from "@/components/candidate/QuickResumeUpload";
import {
  CandidateDetailsModal,
  DeleteModal,
} from "@/components/modal";
import { JobCandidatesSkeleton } from "@/components/candidate/JobCandidatesSkeleton";
import { resumeService } from "@/apis/resume";
import { useDeleteConfirmation } from "@/hooks";
import type { PaginationState } from "@tanstack/react-table";
import { Button } from "@/components";
import type { CandidateActiveFilters } from "@/hooks/useCandidateTableFilters";
import { useToast } from "@/components/shared";
import { useAdminCandidates, useJob } from "@/hooks/queries/jobs";


const AdminCandidateSearch = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith("/dashboard/admin");
  const toast = useToast();

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [job, setJob] = useState<JobRead | null>(null);

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Detail Modal State
  const [showDetail, setShowDetail] = useState(false);
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateResponse | null>(null);

  const [filters, setFilters] = useState<CandidateActiveFilters>({
    job: [],
    status: [],
    city: [],
    hr_decision: [],
    hr_score: [],
  });

  const handleFiltersChange = useCallback((newFilters: React.SetStateAction<CandidateActiveFilters>) => {
    setFilters(newFilters);
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, []);

  const {
    data: candidates,
    total,
    loading,
    error: queryError,
    refetch: fetchCandidates,
  } = useAdminCandidates(
    jobId,
    pagination.pageIndex * pagination.pageSize,
    pagination.pageSize,
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
      await resumeService.deleteResume(candidate.applied_job_id, candidate.resume_id);
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
          onFiltersChange={handleFiltersChange}
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

export default AdminCandidateSearch;
