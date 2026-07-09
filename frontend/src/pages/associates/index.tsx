/**
 * @module AdminAssociates
 * @component AdminAssociates
 *
 * Admin page for managing associates.
 * Displays all associates with ability to create, edit, and delete.
 */
import { useState, useEffect } from "react";
import type { AssociateRead } from "@/types/associate";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
import { DataTable } from "@/components/shared/DataTable";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { Edit2, Trash2Icon, ArrowUpDown, AlertCircle, Plus } from "lucide-react";
import { extractErrorMessage } from "@/utils/error";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS, hasPermissions } from "@/lib/permissions";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { useAssociates } from "@/hooks/queries/admin/useAssociate";
import { useDeleteAssociateMutation } from "@/hooks/mutations/admin/useAssociate";
import { usePageFilters } from "@/hooks/usePageFilters";
import DeleteModal from "@/components/modal/DeleteModal";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";

export default function AdminAssociates() {
  const toast = useToast();
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const hasManagePermission = hasPermissions(user?.permissions, PERMISSIONS.ASSOCIATES_MANAGE);
  const deleteAssociateMutation = useDeleteAssociateMutation();

  const { filters, setFilters } = usePageFilters("adminAssociates", {
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
  const [itemToDelete, setItemToDelete] = useState<AssociateRead | null>(null);
  const [overallTotal, setOverallTotal] = useState(0);

  const handleSearchChange = (value: string) => {
    setFilters({
      search: value,
      pageIndex: 0,
    });
  };

  const debouncedSearch = useDebouncedValue(search);
  const { data: associates, total, loading, error, refetch } = useAssociates({
    skip: pageIndex * pageSize,
    limit: pageSize,
    q: debouncedSearch,
  });

  useEffect(() => {
    if (!debouncedSearch && total !== overallTotal) {
      queueMicrotask(() => {
        setOverallTotal(total);
      });
    }
  }, [total, debouncedSearch, overallTotal]);

  /**
   * Performs immediate deletion of an associate.
   * If failure occurs, displays reason in a modal.
   */
  const handleDeleteClick = async (associate: AssociateRead) => {
    try {
      setDeletingId(associate.id);
      setDeleteError(null);
      await deleteAssociateMutation.mutateAsync(associate.id);
      toast.success("Associate deleted successfully");
    } catch (err) {
      const errMsg = extractErrorMessage(err);
      setDeleteError(errMsg);
      setItemToDelete(associate);
      setShowDeleteModal(true);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateClick = () => {
    navigate("/dashboard/admin/associates/new");
  };

  const renderFormattedError = (error: string | null) => {
    if (!error) return null;

    return (
      <div className="space-y-3 font-medium">
        <div className="flex items-start gap-2 text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
        <p className="text-xs text-muted-foreground pl-4 italic">
          Please resolve any active reviews or submissions assigned to this associate before deleting.
        </p>
      </div>
    );
  };

  const handleEditClick = (associate: AssociateRead) => {
    navigate(`/dashboard/admin/associates/${slugify(associate.name)}/edit`, { state: { associate } });
  };

  const columns: ColumnDef<AssociateRead>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <div className="max-w-50">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold text-base"
          >
            Name
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-50 truncate">
          {row.original.name}
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <div className="max-w-75">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold text-base"
          >
            Email
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-75 truncate">
          {row.original.email}
        </div>
      ),
    },
    ...(hasManagePermission
      ? [
          {
            id: "actions",
            header: () => (
              <div className="flex items-center justify-center gap-0.5">
                <span className="text-base">Actions</span>
              </div>
            ),
            cell: ({ row }) => (
              <div className="gap-0.5 flex items-center justify-center">
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
                  <HoverCardContent className="w-fit px-3 py-1 text-xs" side="top">
                    Edit Associate
                  </HoverCardContent>
                </HoverCard>

                <HoverCard>
                  <HoverCardTrigger
                    render={(props) => (
                      <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(row.original)}
                        className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                      >
                        <Trash2Icon className="h-4 w-4 shrink-0" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    )}
                  />
                  <HoverCardContent className="w-fit px-3 py-1 text-xs" side="top">
                    Delete Associate
                  </HoverCardContent>
                </HoverCard>
              </div>
            ),
          } as ColumnDef<AssociateRead>,
        ]
      : []),
  ];

  return (
    <AppPageShell width="wide">
      <PageHeader
        title="Associate Management"
        breadcrumbActions={
          <PermissionGuard permissions={PERMISSIONS.ASSOCIATES_MANAGE} hideWhenDenied>
            <Button onClick={handleCreateClick} size={"sm"} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Associate
            </Button>
          </PermissionGuard>
        }
      />

      {error && !associates.length ? (
        <ErrorDisplay message={error.message} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={associates}
          loading={loading}
          searchKey="name"
          searchPlaceholder="Filter associates by name..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          isServerSide={true}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={Math.ceil(total / pageSize)}
          onPaginationChange={setPagination}
          totalRecords={total}
          totalCount={overallTotal}
          resultCount={associates.length}
          entityName="Associates"
        />
      )}

      <DeleteModal
        show={showDeleteModal}
        handleClose={() => setShowDeleteModal(false)}
        handleConfirm={() => { }}
        title="Delete Associate Error"
        message={itemToDelete ? `Unable to delete associate "${itemToDelete.name}"` : ""}
        isLoading={false}
        error={renderFormattedError(deleteError)}
        showFooterButtons={false}
      />
    </AppPageShell>
  );
}
