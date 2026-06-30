/**
 * @module AdminJobs
 * @component AdminJobs
 *
 * Admin page for listing, filtering, and organizing jobs.
 */
import { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useDeleteJobMutation, useUpdateJobMutation } from "@/hooks/mutations/jobs/useJobMutations";
import AppPageShell from "@/components/shared/AppPageShell";
import { DataTable } from "@/components/shared/DataTable";
import type { Job } from "@/types/job";
import { extractErrorMessage } from "@/utils/error";
import { slugify } from "@/utils/slug";
import { useAdminJobs } from "@/hooks/queries/jobs/useAdminJobs";

// Sub-components
import { JobBoardHeader } from "@/components/job/job-board/JobBoardHeader";
import { JobDeleteDialog } from "@/components/job/job-board/JobDeleteDialog";
import { getJobColumns } from "@/components/job/job-board/JobColumns";
import { JobTableFilters } from "@/components/job/job-board/JobTableFilters";
import {
  useJobTableFilters,
  useFilteredJobs,
  useFilteredDepartmentOptions,
  useFilteredStatusOptions,
} from "@/hooks/useJobTableFilters";
import { JobActivityModal } from "@/components/job/job-board/JobActivityModal";
import { useDebouncedValue } from "@/hooks/useDebounced";

/**
 * AdminJobs page component.
 * Mirrored from the dashboard job-board to provide consistent experience with filtration.
 * Uses server-side pagination for better performance with large datasets.
 */
export default function AdminJobs() {
  const navigate = useNavigate();
  const deleteMutation = useDeleteJobMutation();
  const updateMutation = useUpdateJobMutation();
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [selectedJobForActivity, setSelectedJobForActivity] = useState<Job | null>(null);

  const {
    titleFilter,
    setTitleFilter,
    statusFilter,
    setStatusFilter,
    departmentFilter,
    setDepartmentFilter,
    dateRange,
    setDateRange,
    allDepartments,
    departmentSearch,
    setDepartmentSearch,
    hasActiveFilters,
    clearFilters,
    pagination,
    setPagination,
  } = useJobTableFilters("adminJobs");

  const debouncedTitle = useDebouncedValue(titleFilter, 500);

  // Wrappers for setters that also reset pagination
  const handleSetTitleFilter = (val: string) => {
    setTitleFilter(val);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleSetStatusFilter = (val: string[]) => {
    setStatusFilter(val);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleSetDepartmentFilter = (val: string[]) => {
    setDepartmentFilter(val);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleClearFilters = () => {
    clearFilters();
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // Prepare filter params for useAdminJobs query
  const queryFilters = useMemo(() => {
    let statusParam: boolean | boolean[] | undefined = undefined;
    if (statusFilter.length > 0) {
      statusParam = statusFilter.map((s) => s === "open");
    }

    let departmentIdParam: string | string[] | undefined = undefined;
    if (departmentFilter.length > 0) {
      departmentIdParam = departmentFilter;
    }

    return {
      q: debouncedTitle || undefined,
      status: statusParam,
      department_id: departmentIdParam,
    };
  }, [debouncedTitle, statusFilter, departmentFilter]);

  const { data: queryData, loading, total, } = useAdminJobs(
    pagination.pageIndex * pagination.pageSize,
    pagination.pageSize,
    queryFilters
  );

  const jobsList = (queryData || []) as unknown as Job[];

  const { filteredJobs, minDate } = useFilteredJobs(jobsList, dateRange);
  const departmentOptions = useFilteredDepartmentOptions(jobsList, allDepartments, titleFilter, statusFilter, departmentFilter);
  const statusOptions = useFilteredStatusOptions(jobsList, titleFilter);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pagination.pageIndex, pagination.pageSize]);

  /** Opens the delete-confirmation dialog for the given job. */
  const handleDeleteClick = (job: Job) => {
    setJobToDelete(job);
    setIsDeleteDialogOpen(true);
  };

  /** Deletes the selected job via the admin API, refreshes the list, and closes the dialog. */
  const handleDeleteConfirm = () => {
    if (!jobToDelete) return;

    deleteMutation.mutate(jobToDelete.id, {
      onSuccess: () => {
        toast.success("Job deleted successfully");
      },
      onError: (error) => {
        console.error("Failed to delete job:", error);
        const errorMessage = extractErrorMessage(error, "Failed to delete job.");
        toast.error(errorMessage);
      },
      onSettled: () => {
        setIsDeleteDialogOpen(false);
        setJobToDelete(null);
      },
    });
  };

  const handleToggleStatus = useCallback(
    (job: Job) => {
      setLoadingJobId(job.id);
      updateMutation.mutate(
        { jobId: job.id, data: { is_active: !job.is_active } },
        {
          onSuccess: () => {
            toast.success(`Job ${!job.is_active ? "activated" : "deactivated"} successfully`);
          },
          onError: (error) => {
            console.error("Failed to toggle job status:", error);
            const errorMessage = extractErrorMessage(error, "Failed to update job status");
            toast.error(errorMessage);
          },
          onSettled: () => {
            setLoadingJobId(null);
          },
        }
      );
    },
    [updateMutation],
  );

  /** Memoized column definitions. */
  const columns = useMemo(
    () =>
      getJobColumns({
        onToggleStatus: handleToggleStatus,
        onDelete: handleDeleteClick,
        onEdit: (job) => {
          setLoadingJobId(job.id);
          const slug = slugify(job.title);
          navigate(`/dashboard/jobs/${slug}/edit`, { state: { jobId: job.id } });
        },
        onCandidates: (job) => {
          const slug = slugify(job.title);
          navigate(`/dashboard/jobs/${slug}/candidates`, {
            state: { jobId: job.id },
          });
        },
        onViewSessions: (job) => {
          setSelectedJobForActivity(job);
          setIsActivityModalOpen(true);
        },
        onSessionCandidates: (job, startDate, endDate) => {
          const slug = slugify(job.title);
          const params = new URLSearchParams();
          if (startDate) params.set("start_date", startDate);
          if (endDate) params.set("end_date", endDate);

          navigate(`/dashboard/jobs/${slug}/candidates?${params.toString()}`, {
            state: { jobId: job.id },
          });
        },
        loadingJobId,
      }),
    [navigate, handleToggleStatus, loadingJobId],
  );

  return (
    <AppPageShell width="wide">
      <JobBoardHeader />

      <div>
        <div className="space-y-4">
          <JobTableFilters
            titleFilter={titleFilter}
            setTitleFilter={handleSetTitleFilter}
            statusFilter={statusFilter}
            setStatusFilter={handleSetStatusFilter}
            statusOptions={statusOptions}
            departmentFilter={departmentFilter}
            setDepartmentFilter={handleSetDepartmentFilter}
            dateRange={dateRange}
            setDateRange={setDateRange}
            departmentOptions={departmentOptions}
            departmentSearch={departmentSearch}
            setDepartmentSearch={setDepartmentSearch}
            hasActiveFilters={hasActiveFilters}
            clearFilters={handleClearFilters}
            resultCount={filteredJobs.length}
            totalCount={total}
            minDate={minDate}
          />
          <DataTable
            columns={columns}
            data={filteredJobs}
            pageCount={Math.ceil(total / pagination.pageSize)}
            onPaginationChange={setPagination}
            loading={loading}
            isServerSide={true}
            emptyMessage="No Jobs found"
            pageIndex={pagination.pageIndex}
            pageSize={pagination.pageSize}
            totalCount={total}
            entityName="Jobs"
            totalRecords={total}
          />
        </div>

      </div>

      <JobDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        job={jobToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />

      <JobActivityModal
        isOpen={isActivityModalOpen}
        onOpenChange={setIsActivityModalOpen}
        job={selectedJobForActivity}
        onSessionClick={(start, end) => {
          if (!selectedJobForActivity) return;
          const slug = slugify(selectedJobForActivity.title);
          const params = new URLSearchParams();
          if (start) params.set("start_date", start);
          if (end) params.set("end_date", end);

          navigate(`/dashboard/jobs/${slug}/candidates?${params.toString()}`, {
            state: { jobId: selectedJobForActivity.id },
          });
          setIsActivityModalOpen(false);
        }}
      />
    </AppPageShell>
  );
};
