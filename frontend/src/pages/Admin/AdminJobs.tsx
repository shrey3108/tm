import { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { adminJobService } from "@/apis/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import { DataTable } from "@/components/shared/DataTable";
import type { Job } from "@/types/job";
import { extractErrorMessage } from "@/utils/error";
import { slugify } from "@/utils/slug";
import type { PaginationState } from "@tanstack/react-table";
import { useAdminJobs } from "@/hooks/queries/jobs";

// Sub-components
import { JobBoardHeader } from "@/components/job-board/JobBoardHeader";
import { JobDeleteDialog } from "@/components/job-board/JobDeleteDialog";
import { getJobColumns } from "@/components/job-board/JobColumns";
import { JobTableFilters } from "@/components/job-board/JobTableFilters";
import { useJobTableFilters } from "@/hooks/useJobTableFilters";
import { JobActivityModal } from "@/components/job-board/JobActivityModal";
import { useDebouncedValue } from "@/hooks";

/**
 * AdminJobs page component.
 * Mirrored from the dashboard job-board to provide consistent experience with filtration.
 * Uses server-side pagination for better performance with large datasets.
 */
const AdminJobs = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [selectedJobForActivity, setSelectedJobForActivity] = useState<Job | null>(null);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const {
    titleFilter,
    setTitleFilter,
    statusFilter,
    setStatusFilter,
    departmentFilter,
    setDepartmentFilter,
    dateRange,
    setDateRange,
    departmentOptions,
    departmentSearch,
    setDepartmentSearch,
    filteredJobs,
    hasActiveFilters,
    clearFilters,
    minDate
  } = useJobTableFilters(jobs);

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
      statusParam = statusFilter.map((s) => s === "active");
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

  const {
    data: queryData,
    loading,
    refetch,
    total,
  } = useAdminJobs(
    pagination.pageIndex * pagination.pageSize,
    pagination.pageSize,
    queryFilters
  );

  // Synchronize query results with local jobs state
  useEffect(() => {
    if (queryData) {
      setJobs(queryData as unknown as Job[]);
    }
  }, [queryData]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pagination.pageIndex, pagination.pageSize]);

  /** Opens the delete-confirmation dialog for the given job. */
  const handleDeleteClick = (job: Job) => {
    setJobToDelete(job);
    setIsDeleteDialogOpen(true);
  };

  /** Deletes the selected job via the admin API, refreshes the list, and closes the dialog. */
  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;

    try {
      await adminJobService.deleteJob(jobToDelete.id);
      toast.success("Job deleted successfully");
      refetch();
    } catch (error) {
      console.error("Failed to delete job:", error);
      const errorMessage = extractErrorMessage(error, "Failed to delete job.");
      toast.error(errorMessage);
    } finally {
      setIsDeleteDialogOpen(false);
      setJobToDelete(null);
    }
  };

  const handleToggleStatus = useCallback(
    async (job: Job) => {
      setLoadingJobId(job.id);
      // Optimistic update
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, is_active: !job.is_active } : j
        )
      );

      try {
        await adminJobService.updateJob(job.id, { is_active: !job.is_active });
        toast.success(`Job ${!job.is_active ? "activated" : "deactivated"} successfully`);
      } catch (error) {
        // Rollback on error
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, is_active: job.is_active } : j
          )
        );
        console.error("Failed to toggle job status:", error);
        const errorMessage = extractErrorMessage(error, "Failed to update job status");
        toast.error(errorMessage);
      } finally {
        setLoadingJobId(null);
      }
    },
    [],
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

export default AdminJobs;
