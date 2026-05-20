/**
 * Admin page for managing job priorities.
 * Displays all job priorities with ability to create, edit, and delete.
 */
import { useState, useEffect } from "react";
import { adminJobPriorityService } from "@/apis/admin";
import type { JobPriorityRead } from "@/types/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
import { DataTable } from "@/components/shared/DataTable";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { CreateJobPriorityModal, DeleteModal } from "@/components/modal";
import { useAdminData, useDebouncedValue } from "@/hooks";
import { Edit2, Trash2Icon, ArrowUpDown, Clock, AlertCircle, Plus } from "lucide-react";
import { extractErrorMessage } from "@/utils/error";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button } from "@/components";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { DateDisplay } from "@/components/shared";

const AdminJobPriorities = () => {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<JobPriorityRead | null>(null);
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search, 500);
  // Reset to first page when search changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch]);

  const {
    data: priorities,
    total,
    loading,
    error,
    fetchData: fetchPriorities,
  } = useAdminData<JobPriorityRead>(
    () => adminJobPriorityService.getAllPriorities(pageIndex * pageSize, pageSize, debouncedSearch),
    { fetchOnMount: false }
  );

  // Refetch when pagination or search changes
  useEffect(() => {
    fetchPriorities();
  }, [pageIndex, pageSize, debouncedSearch, fetchPriorities]);

  const [overallTotal, setOverallTotal] = useState(0);
  useEffect(() => {
    if (!debouncedSearch) {
      setOverallTotal(total);
    }
  }, [total, debouncedSearch]);

  const [_deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<JobPriorityRead | null>(null);

  /**
   * Performs immediate deletion of a priority.
   * If failure occurs, displays reason in a modal.
   */
  const handleDeleteClick = async (priority: JobPriorityRead) => {
    try {
      setDeletingId(priority.id);
      setDeleteError(null);
      await adminJobPriorityService.deletePriority(priority.id);
      fetchPriorities();
      toast.success("Priority deleted successfully");
    } catch (err) {
      const errMsg = extractErrorMessage(err);
      setDeleteError(errMsg);
      setItemToDelete(priority);
      setShowDeleteModal(true);
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * Parses the backend error message to extract job names if the priority is in use.
   */
  const renderFormattedError = (error: string | null) => {
    if (!error) return null;

    let mainMessage = "";
    let jobNamesStr = "";

    // Try new format: "Cannot delete priority 'P1' because it is assigned to: "Job A", "Job B". Please reassign..."
    const newFormatMatch = error.match(/because it is assigned to:\s*(.*?)\.\s*Please reassign/i);
    // Try old format: "ACTIVE Job(s): [Job A, Job B]"
    const oldFormatMatch = error.match(/active job\(s\): \[(.*?)\]/i);

    if (newFormatMatch) {
      mainMessage = error.split(/because it is assigned to:/i)[0].trim();
      jobNamesStr = newFormatMatch[1];
    } else if (oldFormatMatch) {
      mainMessage = error.split(/active job\(s\):/i)[0].trim();
      jobNamesStr = oldFormatMatch[1];
    } else {
      return error;
    }

    // Simple parser for comma-separated job names
    const jobNames = jobNamesStr
      .split(",")
      .map((name) => {
        let trimmed = name.trim();
        // remove quotes or brackets if they exist (for robustness)
        if (
          (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
          (trimmed.startsWith('"') && trimmed.endsWith('"'))
        ) {
          return trimmed.slice(1, -1);
        }
        return trimmed;
      })
      .filter(Boolean);

    return (
      <div className="space-y-3 font-medium">
        <div className="flex items-start gap-2 text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-sm font-semibold">{mainMessage}</p>
        </div>
        <div className="flex flex-wrap gap-2 pl-6">
          {jobNames.map((job, idx) => (
            <Badge key={idx} variant="outline" className="border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors">
              {job}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground pl-6 italic">
          Please reassign or remove from these jobs before deleting.
        </p>
      </div>
    );
  };

  const handleCreateClick = () => {
    setSelectedPriority(null);
    setShowModal(true);
  };

  const handleEditClick = (priority: JobPriorityRead) => {
    setSelectedPriority(priority);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedPriority(null);
  };

  const columns: ColumnDef<JobPriorityRead>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold"
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "duration_days",
      // header: "Duration (Days)",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold"
        >
          Duration (Days)
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{row.original.duration_days} days</span>
        </div>
      ),
    },
    {
      accessorKey: "created_at",
      // header: "Created At",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold"
        >
          Created At
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),

      cell: ({ row }) => <div className="flex items-center gap-2">
        <DateDisplay date={row.original.created_at} />
      </div>,
    },
    {
      accessorKey: "assigned_jobs_count",
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold"
          >
            Assigned Jobs Count
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-center ">
          {row.original.assigned_jobs_count}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => (
        <div className="flex items-center justify-center gap-2">
          <span className="font-semibold">
            Actions
          </span>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2">
          <PermissionGuard permissions={PERMISSIONS.ADMIN_ACCESS} hideWhenDenied>
            <HoverCard>
              <HoverCardTrigger
                render={(props) => (
                  <Button
                    {...props}
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditClick(row.original)}
                    className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center shrink-0"
                    disabled={row.original.assigned_jobs_count > 0}
                  >
                    <Edit2 className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Edit</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
                <span className="text-primary">Edit Priority</span>
              </HoverCardContent>
            </HoverCard>
          </PermissionGuard>
          <PermissionGuard permissions={PERMISSIONS.ADMIN_ACCESS} hideWhenDenied>
            <HoverCard>
              <HoverCardTrigger
                render={(props) => (
                  <Button
                    {...props}
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(row.original)}
                    className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center justify-center shrink-0"
                    disabled={row.original.assigned_jobs_count > 0}
                  >
                    <Trash2Icon className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Delete</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
                <span className="text-destructive">Delete Priority</span>
              </HoverCardContent>
            </HoverCard>
          </PermissionGuard>
        </div>
      ),
    },
  ];

  return (
    <AppPageShell width="wide">
      <PageHeader
        title="Job Priorities"
        // subtitle="Manage job priorities and their durations for the hiring platform."
        breadcrumbActions={
          <PermissionGuard permissions={PERMISSIONS.ADMIN_ACCESS} hideWhenDenied>
            <Button onClick={handleCreateClick} size={"sm"} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Priority
            </Button>
          </PermissionGuard>
        }
      />

      {error ? (
        <ErrorDisplay message={error} onRetry={fetchPriorities} />
      ) : (
        <DataTable
          columns={columns}
          data={priorities}
          loading={loading}
          searchKey="name"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Filter priorities by name..."
          initialSorting={[{ id: "name", desc: false }]}
          isServerSide={true}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={Math.ceil(total / pageSize)}
          onPaginationChange={setPagination}
          totalRecords={total}
          totalCount={overallTotal}
          resultCount={priorities.length}
          entityName="Priorities"
        />
      )}

      <CreateJobPriorityModal
        show={showModal}
        handleClose={handleCloseModal}
        onPrioritySaved={fetchPriorities}
        priority={selectedPriority}
      />

      <DeleteModal
        show={showDeleteModal}
        handleClose={() => setShowDeleteModal(false)}
        handleConfirm={() => { }} // Not used as we delete before opening modal
        title="Delete Priority Error"
        message={itemToDelete ? `Unable to delete priority "${itemToDelete.name}"` : ""}
        isLoading={false}
        error={renderFormattedError(deleteError)}
        showFooterButtons={false}
      />
    </AppPageShell>
  );
};

export default AdminJobPriorities;
