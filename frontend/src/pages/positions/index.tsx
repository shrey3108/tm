/**
 * @module AdminJobPositions
 * @component AdminJobPositions
 *
 * Admin page for managing job positions.
 * Displays all positions with ability to create, edit, and delete.
 */
import { useState, useEffect } from "react";
import type { JobPositionRead } from "@/types/jobPosition";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
import { DataTable } from "@/components/shared/DataTable";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import DeleteModal from "@/components/modal/DeleteModal";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { Edit2, Trash2Icon, ArrowUpDown, AlertCircle, Plus } from "lucide-react";
import { extractErrorMessage } from "@/utils/error";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { useJobPosition } from "@/hooks/queries/admin/useJobPosition";
import { useDeletePositionMutation } from "@/hooks/mutations/admin/useJobPosition";
import { usePageFilters } from "@/hooks/usePageFilters";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";

export default function AdminJobPositions() {
  const toast = useToast();
  const navigate = useNavigate();
  const deletePositionMutation = useDeletePositionMutation();

  const { filters, setFilters } = usePageFilters("adminJobPositions", {
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

  const [overallTotal, setOverallTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<JobPositionRead | null>(null);

  const debouncedSearch = useDebouncedValue(search);

  const { data: positions, total, loading, error, refetch } = useJobPosition({
    skip: pageIndex * pageSize,
    limit: pageSize,
    q: debouncedSearch,
  });

  const handleSearchChange = (value: string) => {
    setFilters({
      search: value,
      pageIndex: 0,
    });
  };

  useEffect(() => {
    if (!debouncedSearch && overallTotal !== total) {
      queueMicrotask(() => {
        setOverallTotal(total);
      });
    }
  }, [total, debouncedSearch, overallTotal]);

  const handleDeleteClick = async (pos: JobPositionRead) => {
    try {
      setDeletingId(pos.id);
      setDeleteError(null);
      await deletePositionMutation.mutateAsync(pos.id);
      toast.success("Position deleted successfully");
    } catch (err) {
      const errMsg = extractErrorMessage(err);
      setDeleteError(errMsg);
      setItemToDelete(pos);
      setShowDeleteModal(true);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateClick = () => {
    navigate("/dashboard/admin/criteria-stages/positions/new");
  };

  const handleEditClick = (pos: JobPositionRead) => {
    navigate(`/dashboard/admin/criteria-stages/positions/${slugify(pos.name)}/edit`, { state: { position: pos } });
  };

  const renderFormattedError = (error: string | null) => {
    if (!error) return null;

    const jobMatch = error.match(/active job\(s\): \[(.*?)\]/i);
    if (!jobMatch) return error;

    const mainMessage = error.split(/active job\(s\):/i)[0].trim();
    const jobNamesStr = jobMatch[1];

    const jobNames = jobNamesStr
      .split(",")
      .flatMap((name) => {
        let trimmed = name.trim();
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
          Please deactivate or remove this position from these jobs before deleting.
        </p>
      </div>
    );
  };

  const columns: ColumnDef<JobPositionRead>[] = [
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
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base">
          Created Date
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <DateDisplay date={row.original.created_at} showIcon />
      )
    },
    {
      accessorKey: "updated_at",
      header: ({ column }) => (
        <Button variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base">
          Updated Date
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <DateDisplay date={row.original.updated_at} showIcon />
      )
    },
    {
      id: "actions",
      header: () => (
        <div className="flex items-center justify-center">
          <span className="text-base">
            Actions
          </span>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-0.5">
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
                  >
                    <Edit2 className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Edit</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                Edit Position
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
                    disabled={deletingId === row.original.id}
                    className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                  >
                    <Trash2Icon className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Delete</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                Delete Position
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
        title="Job Position Management"
        breadcrumbActions={
          <PermissionGuard permissions={PERMISSIONS.ADMIN_ACCESS} hideWhenDenied>
            <Button onClick={handleCreateClick} className="gap-2" size={"sm"}>
              <Plus className="h-4 w-4" />
              Create Position
            </Button>
          </PermissionGuard>
        }
      />

      {error && !positions.length ? (
        <ErrorDisplay message={error.message} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={positions}
          loading={loading}
          searchKey="name"
          searchValue={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Filter positions by name..."
          isServerSide={true}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={Math.ceil(total / pageSize)}
          onPaginationChange={setPagination}
          totalRecords={total}
          totalCount={overallTotal}
          resultCount={positions.length}
          entityName="Positions"
        />
      )}

      <DeleteModal
        show={showDeleteModal}
        handleClose={() => setShowDeleteModal(false)}
        handleConfirm={() => { }}
        title="Delete Position Error"
        message={itemToDelete ? `Unable to delete position "${itemToDelete.name}"` : ""}
        isLoading={false}
        error={renderFormattedError(deleteError)}
        showFooterButtons={false}
      />
    </AppPageShell>
  );
}
