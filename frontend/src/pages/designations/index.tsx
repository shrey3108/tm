/**
 * @module AdminDesignations
 * @component AdminDesignations
 *
 * Admin page for managing designations.
 * Displays all designations with ability to create, edit, and delete.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { DesignationRead } from "@/types/designation";
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
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { useDesignations } from "@/hooks/queries/admin/useDesignation";
import { useDeleteDesignationMutation } from "@/hooks/mutations/admin/useDesignation";
import { usePageFilters } from "@/hooks/usePageFilters";
import { slugify } from "@/utils/slug";

export default function AdminDesignations() {
  const toast = useToast();
  const navigate = useNavigate();
  const deleteDesignationMutation = useDeleteDesignationMutation();

  const { filters, setFilters } = usePageFilters("adminDesignations", {
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

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DesignationRead | null>(null);
  const [overallTotal, setOverallTotal] = useState(0);

  const debouncedSearch = useDebouncedValue(search);


  const { data: designations, total, loading, error, refetch } = useDesignations({
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
    if (!debouncedSearch && total !== overallTotal) {
      queueMicrotask(() => {
        setOverallTotal(total);
      });
    }
  }, [total, debouncedSearch, overallTotal]);

  const handleCreateClick = () => {
    navigate("/dashboard/admin/designations/new");
  };

  const handleEditClick = (desig: DesignationRead) => {
    navigate(`/dashboard/admin/designations/${slugify(desig.name)}/edit`, {
      state: { designation: desig },
    });
  };

  const handleDeleteClick = async (desig: DesignationRead) => {
    try {
      setDeletingId(desig.id);
      setDeleteError(null);
      await deleteDesignationMutation.mutateAsync(desig.id);
      toast.success("Designation deleted successfully");
    } catch (err) {
      const errMsg = extractErrorMessage(err);
      setDeleteError(errMsg);
      setItemToDelete(desig);
      setShowDeleteModal(true);
    } finally {
      setDeletingId(null);
    }
  };

  const renderFormattedError = (err: string | null) => {
    if (!err) return null;
    return (
      <div className="space-y-3 font-medium">
        <div className="flex items-start gap-2 text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-sm font-semibold">{err}</p>
        </div>
        <p className="text-xs text-muted-foreground pl-6 italic">
          Please remove or reassign any associates linked to this designation before deleting.
        </p>
      </div>
    );
  };

  const columns: ColumnDef<DesignationRead>[] = [
    {
      accessorKey: "name",
      size: 40,
      meta: { overflow: "ellipsis" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Name
          <ArrowUpDown className="h-4 w-4 ml-1" />
        </Button>
      ),
    },
    {
      accessorKey: "created_at",
      size: 25,
      meta: { overflow: "ellipsis" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Created Date
          <ArrowUpDown className="h-4 w-4 ml-1" />
        </Button>
      ),
      cell: ({ row }) => <DateDisplay date={row.original.created_at} showIcon />,
    },
    {
      accessorKey: "updated_at",
      size: 25,
      meta: { overflow: "ellipsis" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Updated Date
          <ArrowUpDown className="h-4 w-4 ml-1" />
        </Button>
      ),
      cell: ({ row }) => <DateDisplay date={row.original.updated_at} showIcon />,
    },
    {
      id: "actions",
      size: 10,
      meta: { overflow: "ellipsis" },
      header: () => (
        <div className="flex items-center justify-center">
          <span className="text-base">Actions</span>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-0.5">
          <PermissionGuard permissions={PERMISSIONS.ASSOCIATES_MANAGE} hideWhenDenied>
            <HoverCard>
              <HoverCardTrigger
                render={(props) => (
                  <Button
                    {...props}
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditClick(row.original)}
                    className="h-7 w-7 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                  >
                    <Edit2 className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Edit</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                Edit Designation
              </HoverCardContent>
            </HoverCard>
          </PermissionGuard>

          <PermissionGuard permissions={PERMISSIONS.ASSOCIATES_MANAGE} hideWhenDenied>
            <HoverCard>
              <HoverCardTrigger
                render={(props) => (
                  <Button
                    {...props}
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(row.original)}
                    disabled={deletingId === row.original.id}
                    className="h-7 w-7 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                  >
                    <Trash2Icon className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Delete</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                Delete Designation
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
        title="Designation Management"
        breadcrumbActions={
          <PermissionGuard permissions={PERMISSIONS.ASSOCIATES_MANAGE} hideWhenDenied>
            <Button onClick={handleCreateClick} className="gap-2" size={"sm"}>
              <Plus className="h-4 w-4" />
              Create Designation
            </Button>
          </PermissionGuard>
        }
      />

      {error && !designations.length ? (
        <ErrorDisplay message={error.message} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={designations}
          loading={loading}
          searchKey="name"
          searchValue={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Filter designations by name..."
          isServerSide={true}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={Math.ceil(total / pageSize)}
          onPaginationChange={setPagination}
          totalRecords={total}
          totalCount={overallTotal}
          resultCount={designations.length}
          entityName="Designations"
        />
      )}

      <DeleteModal
        show={showDeleteModal}
        handleClose={() => setShowDeleteModal(false)}
        handleConfirm={() => { }}
        title="Delete Designation Error"
        message={itemToDelete ? `Unable to delete designation "${itemToDelete.name}"` : ""}
        isLoading={false}
        error={renderFormattedError(deleteError)}
        showFooterButtons={false}
      />
    </AppPageShell>
  );
}
