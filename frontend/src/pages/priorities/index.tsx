/**
 * @module AdminJobPriorities
 * @component AdminJobPriorities
 *
 * Admin page for managing job priorities.
 * Displays all job priorities with ability to create, edit, and delete.
 */
import { useState, useEffect } from "react";
import type { JobPriorityRead } from "@/types/jobPriority";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
import { DataTable } from "@/components/shared/DataTable";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { Edit2, Trash2Icon, ArrowUpDown, Clock, AlertCircle, Plus } from "lucide-react";
import { extractErrorMessage } from "@/utils/error";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { useJobPriorities } from "@/hooks/queries/admin/useJobPriority";
import { useDeletePriorityMutation } from "@/hooks/mutations/admin/useJobPriority";
import { usePageFilters } from "@/hooks/usePageFilters";
import DeleteModal from "@/components/modal/DeleteModal";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";

export default function AdminJobPriorities() {
  const toast = useToast();
  const navigate = useNavigate();
  const deletePriorityMutation = useDeletePriorityMutation();

  const { filters, setFilters } = usePageFilters("adminJobPriorities", {
    pageIndex: 0,
    pageSize: 10,
    search: "",
  });
  const { pageIndex, pageSize, search } = filters;

  const setPagination = (val: PaginationState | ((prev: PaginationState) => PaginationState)) => {
    const currentPagination = { pageIndex: filters.pageIndex, pageSize: filters.pageSize };
    const nextPagination = typeof val === "function" ? val(currentPagination) : val;
    setFilters({
      pageIndex: nextPagination.pageIndex,
      pageSize: nextPagination.pageSize,
    });
  };

  const [, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<JobPriorityRead | null>(null);
  const [overallTotal, setOverallTotal] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 500);

  const handleSearchChange = (value: string) => {
    setFilters({
      search: value,
      pageIndex: 0,
    });
  };

  const { data: priorities, loading, error, refetch, total } = useJobPriorities({
    skip: pageIndex * pageSize,
    limit: pageSize,
    q: debouncedSearch,
  });

  useEffect(() => {
    if (!debouncedSearch && overallTotal !== total) {
      queueMicrotask(() => {
        setOverallTotal(total);
      });
    }
  }, [total, debouncedSearch, overallTotal]);

  /**
   * Performs immediate deletion of a priority.
   * If failure occurs, displays reason in a modal.
   */
  const handleDeleteClick = async (priority: JobPriorityRead) => {
    try {
      setDeletingId(priority.id);
      setDeleteError(null);
      await deletePriorityMutation.mutateAsync(priority.id);
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

    const newFormatMatch = error.match(/because it is assigned to:\s*(.*?)\.\s*Please reassign/i);
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

    const jobNames = jobNamesStr
      .split(",")
      .flatMap((name) => {
        const trimmed = name.trim();
        const val =
          (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
          (trimmed.startsWith('"') && trimmed.endsWith('"'))
            ? trimmed.slice(1, -1)
            : trimmed;
        return val ? [val] : [];
      });

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
    navigate("/dashboard/admin/settings/priorities/new");
  };

  const handleEditClick = (priority: JobPriorityRead) => {
    navigate(`/dashboard/admin/settings/priorities/${slugify(priority.name)}/edit`, { state: { priority } });
  };

  const columns: ColumnDef<JobPriorityRead>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Name
          <ArrowUpDown className="h-4 w-4" />
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
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Duration (Days)
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>{row.original.duration_days} days</span>
        </div>
      ),
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Created At
          <ArrowUpDown className="h-4 w-4" />
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
            className="hover:bg-transparent p-0 font-semibold text-base"
          >
            Assigned Jobs Count
            <ArrowUpDown className="h-4 w-4" />
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
      accessorKey: "associate_reminder_hours",
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold text-base"
          >
            Associate Reminder Hours
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-center ">
          {row.original.associate_reminder_hours}
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
                    className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                    disabled={row.original.assigned_jobs_count > 0}
                  >
                    <Edit2 className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Edit</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                Edit Priority
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
                    className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                    disabled={row.original.assigned_jobs_count > 0}
                  >
                    <Trash2Icon className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Delete</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                Delete Priority
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
        <ErrorDisplay message={error.message} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={priorities}
          loading={loading}
          searchKey="name"
          searchValue={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Filter priorities by name..."
          // initialSorting={[{ id: "name", desc: false }]}
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
}
