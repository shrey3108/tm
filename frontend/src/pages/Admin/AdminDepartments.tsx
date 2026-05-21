/**
 * Admin page for managing departments.
 * Displays all departments with ability to create, edit, and delete.
 */
import { useState, useEffect } from "react";
import { adminDepartmentService } from "@/apis/admin";
import type { DepartmentRead } from "@/types/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
import { DataTable } from "@/components/shared/DataTable";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { CreateDepartmentModal, DeleteModal } from "@/components/modal";
import { useAdminData, useDebouncedValue } from "@/hooks";
import { Edit2, Trash2Icon, ArrowUpDown, AlertCircle, Plus } from "lucide-react";
import { extractErrorMessage } from "@/utils/error";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button } from "@/components";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS, hasPermissions } from "@/lib/permissions";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";

const AdminDepartments = () => {
  const toast = useToast();
  const user = useAppSelector(selectCurrentUser);
  const hasManagePermission = hasPermissions(user?.permissions, PERMISSIONS.DEPARTMENTS_MANAGE);
  const [showModal, setShowModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentRead | null>(null);

  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search)
  const {
    data: departments,
    total,
    loading,
    error,
    fetchData: fetchDepartments,
  } = useAdminData<DepartmentRead>(
    () => adminDepartmentService.getAllDepartments(pageIndex * pageSize, pageSize, debouncedSearch),
    { fetchOnMount: false }
  );


  // Reset to first page when search changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch]);


  // Refetch when pagination changes
  useEffect(() => {
    fetchDepartments();
  }, [pageIndex, pageSize, fetchDepartments, debouncedSearch]);

  const [overallTotal, setOverallTotal] = useState(0);
  useEffect(() => {
    if (!debouncedSearch) {
      setOverallTotal(total);
    }
  }, [total, debouncedSearch]);

  const [_deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DepartmentRead | null>(null);

  /**
   * Performs immediate deletion of a department.
   * If failure occurs, displays reason in a modal.
   */
  const handleDeleteClick = async (dept: DepartmentRead) => {
    try {
      setDeletingId(dept.id);
      setDeleteError(null);
      await adminDepartmentService.deleteDepartment(dept.id);
      fetchDepartments();
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
    setSelectedDepartment(null);
    setShowModal(true);
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

    // Simple parser for comma-separated job names: [Job A, Job B]
    const jobNames = jobNamesStr
      .split(",")
      .map((name) => {
        let trimmed = name.trim();
        // remove quotes if they exist (for robustness)
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
          Please deactivate or remove this department from these jobs before deleting.
        </p>
      </div>
    );
  };

  const handleEditClick = (dept: DepartmentRead) => {
    setSelectedDepartment(dept);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedDepartment(null);
  };

  const columns: ColumnDef<DepartmentRead>[] = [
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
    },
    {
      accessorKey: "description",
      // header: "Description",
      header: () => {
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold">Description</span>
          </div>
        )
      },
      cell: ({ row }) => row.original.description || "No description provided",
    },
    ...(hasManagePermission
      ? [
          {
            id: "actions",
            header: () => (
              <div className="flex items-center justify-center gap-2">
                <span className="font-semibold">Actions</span>
              </div>
            ),
            cell: ({ row }) => (
              <div className="flex items-center justify-center gap-2">
                <HoverCard>
                  <HoverCardTrigger
                    render={(props) => (
                      <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(row.original)}
                        className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center shrink-0"
                      >
                        <Edit2 className="h-4 w-4 shrink-0" />
                        <span className="sr-only">Edit</span>
                      </Button>
                    )}
                  />
                  <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
                    <span className="text-primary">Edit Department</span>
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
                        className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center justify-center shrink-0"
                      >
                        <Trash2Icon className="h-4 w-4 shrink-0" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    )}
                  />
                  <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
                    <span className="text-destructive">Delete Department</span>
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
        <ErrorDisplay message={error} onRetry={fetchDepartments} />
      ) : (
        <DataTable
          columns={columns}
          data={departments}
          loading={loading}
          searchKey="name"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Filter departments by name..."
          initialSorting={[{ id: "name", desc: false }]}
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

      <CreateDepartmentModal
        show={showModal}
        handleClose={handleCloseModal}
        onDepartmentSaved={fetchDepartments}
        department={selectedDepartment}
      />

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
};

export default AdminDepartments;
