/**
 * @module AdminDepartments
 * @component AdminDepartments
 *
 * Admin page for managing departments.
 * Displays all departments with ability to create, edit, and delete.
 */
import { useState, useEffect } from "react";
import type { DepartmentRead } from "@/types/department";
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
import { Badge } from "@/components/ui/badge";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS, hasPermissions } from "@/lib/permissions";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { useDepartment } from "@/hooks/queries/admin/useDepartment";
import { useDeleteDepartmentMutation } from "@/hooks/mutations/admin/useDepartment";
import { usePageFilters } from "@/hooks/usePageFilters";
import DeleteModal from "@/components/modal/DeleteModal";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";

export default function AdminDepartments() {
  const toast = useToast();
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const hasManagePermission = hasPermissions(user?.permissions, PERMISSIONS.DEPARTMENTS_MANAGE);
  const deleteDepartmentMutation = useDeleteDepartmentMutation();

  const { filters, setFilters } = usePageFilters("adminDepartments", {
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
  const [itemToDelete, setItemToDelete] = useState<DepartmentRead | null>(null);
  const [overallTotal, setOverallTotal] = useState(0);

  const debouncedSearch = useDebouncedValue(search);
  const { data: departments, total, loading, error, refetch } = useDepartment({ skip: pageIndex * pageSize, limit: pageSize, q: debouncedSearch });

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
   * Performs immediate deletion of a department.
   * If failure occurs, displays reason in a modal.
   */
  const handleDeleteClick = async (dept: DepartmentRead) => {
    try {
      setDeletingId(dept.id);
      setDeleteError(null);
      await deleteDepartmentMutation.mutateAsync(dept.id);
      toast.success("Department deleted successfully");
    } catch (err) {
      const errMsg = extractErrorMessage(err);
      setDeleteError(errMsg);
      setItemToDelete(dept);
      setShowDeleteModal(true);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateClick = () => {
    navigate("/dashboard/admin/departments/new");
  };

  /**
   * Parses the backend error message to extract job names if the department is in use.
   */
  const renderFormattedError = (error: string | null) => {
    if (!error) return null;

    // Get job names
    const jobMatch = error.match(/active job\(s\): \[(.*?)\]/i);
    if (!jobMatch) return error;

    // Get department delete main message
    const mainMessage = error.split(/active job\(s\):/i)[0].trim();
    const jobNamesStr = jobMatch[1];

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
          Please deactivate or remove this department from these jobs before deleting.
        </p>
      </div>
    );
  };

  const handleEditClick = (dept: DepartmentRead) => {
    navigate(`/dashboard/admin/departments/${slugify(dept.name)}/edit`, { state: { department: dept } });
  };

  const columns: ColumnDef<DepartmentRead>[] = [
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
      cell: ({ row }) => <span className="capitalize"> {row.original.name} </span>,
    },
    {
      accessorKey: "description",
      header: () => {
        return (
          <div className="flex items-center gap-2">
            <span className="text-base">Description</span>
          </div>
        );
      },
      cell: ({ row }) => <span className="capitalize"> {row.original.description || "No description provided"}</span>,
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
            <div className="flex items-center justify-center gap-0.5">
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
                  Edit Department
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
                <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                  Delete Department
                </HoverCardContent>
              </HoverCard>
            </div>
          ),
        } as ColumnDef<DepartmentRead>,
      ]
      : []),
  ];

  return (
    <AppPageShell width="wide">
      <PageHeader
        title="Department Management"
        breadcrumbActions={
          <PermissionGuard permissions={PERMISSIONS.DEPARTMENTS_MANAGE} hideWhenDenied>
            <Button onClick={handleCreateClick} size={"sm"} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Department
            </Button>
          </PermissionGuard>
        }
      />

      {error && !departments.length ? (
        <ErrorDisplay message={error.message} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={departments}
          loading={loading}
          searchKey="name"
          searchValue={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Filter departments by name..."
          isServerSide={true}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={Math.ceil(total / pageSize)}
          onPaginationChange={setPagination}
          totalRecords={total}
          totalCount={overallTotal}
          resultCount={departments.length}
          entityName="Departments"
        />
      )}

      <DeleteModal
        show={showDeleteModal}
        handleClose={() => setShowDeleteModal(false)}
        handleConfirm={() => { }} // Not used as we delete before opening modal
        title="Delete Department Error"
        message={itemToDelete ? `Unable to delete department "${itemToDelete.name}"` : ""}
        isLoading={false}
        error={renderFormattedError(deleteError)}
        showFooterButtons={false}
      />
    </AppPageShell>
  );
}
