/**
 * @module AdminGuidelines
 * @component AdminGuidelines
 *
 * Admin page for managing guidelines.
 * Displays all guidelines with ability to create, edit, and delete.
 */
import { useState, useEffect } from "react";
import type { Guideline, GuidelineRead } from "@/types/guideline";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
import { DataTable } from "@/components/shared/DataTable";
import ErrorDisplay from "@/components/shared/ErrorDisplay";

import { useDebouncedValue } from "@/hooks/useDebounced";
import { Edit2, Trash2Icon, ArrowUpDown, AlertCircle, Plus } from "lucide-react";
import { extractErrorMessage } from "@/utils/error";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { useGuidelines } from "@/hooks/queries/admin/useGuideline";
import { useDeleteGuidelineMutation, useUpdateGuidelineMutation } from "@/hooks/mutations/admin/useGuideline";
import { usePageFilters } from "@/hooks/usePageFilters";
import DeleteModal from "@/components/modal/DeleteModal";
import DateDisplay from "@/components/shared/DateDisplay";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";

export default function AdminGuidelines() {
  const toast = useToast();
  const navigate = useNavigate();
  const deleteGuidelineMutation = useDeleteGuidelineMutation();

  const { filters, setFilters } = usePageFilters("adminGuidelines", {
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
  const [itemToDelete, setItemToDelete] = useState<GuidelineRead | null>(null);
  const [overallTotal, setOverallTotal] = useState(0);

  const debouncedSearch = useDebouncedValue(search);

  const { data: guidelines, total, loading, error, refetch } = useGuidelines({
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

  /**
   * Performs immediate deletion of a guideline.
   * If failure occurs, displays reason in a modal.
   */
  const handleDeleteClick = async (guideline: GuidelineRead) => {
    try {
      setDeletingId(guideline.id);
      setDeleteError(null);
      await deleteGuidelineMutation.mutateAsync(guideline.id);
      toast.success("Term & condition deleted successfully");
    } catch (err) {
      const errMsg = extractErrorMessage(err);
      setDeleteError(errMsg);
      setItemToDelete(guideline);
      setShowDeleteModal(true);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateClick = () => {
    navigate("/dashboard/admin/settings/terms-conditions/new");
  };

  const renderFormattedError = (error: string | null) => {
    if (!error) return null;
    return (
      <div className="space-y-4 font-medium">
        <div className="flex items-start gap-2 text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      </div>
    );
  };

  const getGuidelineSlug = (content: string) => slugify(content.slice(0, 30) || "guideline");

  const handleEditClick = (guideline: GuidelineRead) => {
    navigate(`/dashboard/admin/settings/terms-conditions/${getGuidelineSlug(guideline.content)}/edit`, { state: { guideline } });
  };

  const updateGuidelineMutation = useUpdateGuidelineMutation();
  const handleDefaultToggle = async (guideline: Guideline, isChecked: boolean) => {
    try {
      await updateGuidelineMutation.mutateAsync({ id: guideline.id, data: { is_default: isChecked, content: guideline.content || "" } });
      toast.success("Term & condition updated successfully");
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      toast.error(errorMessage || "Failed to update term & condition");
    }
  };

  const columns: ColumnDef<GuidelineRead>[] = [
    {
      accessorKey: "content",
      header: () => <span className="text-base">Content</span>,
      cell: ({ row }) => (
        <div className="max-w-[400px] text-wrap capitalize">
          {row.original.content}
        </div>
      ),
    },
    {
      accessorKey: "is_default",
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold text-base"
          >
            Default Stage
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2">
          <Switch
            checked={row.original.is_default ?? false}
            onCheckedChange={(isChecked) => handleDefaultToggle(row.original, isChecked)}
            size="default"
          />
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
          <ArrowUpDown className="h-4 w-4 ml-1" />
        </Button>
      ),
      cell: ({ row }) => <DateDisplay date={row.original.created_at} />,
    },
    {
      id: "actions",
      header: () => (
        <div className="flex items-center justify-center gap-0.5">
          <span className="text-base">Actions</span>
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
              <HoverCardContent className="w-fit px-3 py-1 text-xs" side="top">
                Edit Term & Condition
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
                  >
                    <Trash2Icon className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Delete</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1 text-xs" side="top">
                Delete Term & Condition
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
        title="Terms & Conditions Management"
        breadcrumbActions={
          <PermissionGuard permissions={PERMISSIONS.ADMIN_ACCESS} hideWhenDenied>
            <Button onClick={handleCreateClick} size={"sm"} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Term & Condition
            </Button>
          </PermissionGuard>
        }
      />

      {error && !guidelines.length ? (
        <ErrorDisplay message={error.message} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={guidelines}
          loading={loading}
          searchKey="content"
          searchValue={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Filter terms & conditions by content..."
          isServerSide={true}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={Math.ceil(total / pageSize)}
          onPaginationChange={setPagination}
          totalRecords={total}
          totalCount={overallTotal}
          resultCount={guidelines.length}
          entityName="Terms & Conditions"
        />
      )}

      <DeleteModal
        show={showDeleteModal}
        handleClose={() => setShowDeleteModal(false)}
        handleConfirm={() => { }}
        title="Delete Term & Condition Error"
        message={itemToDelete ? `Unable to delete term & condition` : ""}
        isLoading={false}
        error={renderFormattedError(deleteError)}
        showFooterButtons={false}
      />
    </AppPageShell>
  );
}
