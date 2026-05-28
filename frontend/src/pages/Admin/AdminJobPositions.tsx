/**
 * Admin page for managing job positions.
 * Displays all positions with ability to create, edit, and delete.
 */
import { useState, useEffect } from "react";
import { adminJobPositionService } from "@/apis/admin";
import type { JobPositionRead } from "@/types/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
import { DataTable } from "@/components/shared/DataTable";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { PositionModal, DeleteModal } from "@/components/modal";
import { useAdminData, useDebouncedValue } from "@/hooks";
import { Edit2, Trash2Icon, ArrowUpDown, AlertCircle, Plus } from "lucide-react";
import { extractErrorMessage } from "@/utils/error";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button } from "@/components";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { DateDisplay } from "@/components/shared";

const AdminJobPositions = () => {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<JobPositionRead | null>(null);

  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const {
    data: positions,
    total,
    loading,
    error,
    fetchData: fetchPositions,
  } = useAdminData<JobPositionRead>(
    () => adminJobPositionService.getAllPositions(pageIndex * pageSize, pageSize, debouncedSearch),
    { fetchOnMount: false }
  );

  // Reset to first page when search changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch]);

  // Refetch when pagination or search changes
  useEffect(() => {
    fetchPositions();
  }, [pageIndex, pageSize, fetchPositions, debouncedSearch]);

  const [overallTotal, setOverallTotal] = useState(0);
  useEffect(() => {
    if (!debouncedSearch) {
      setOverallTotal(total);
    }
  }, [total, debouncedSearch]);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<JobPositionRead | null>(null);

  const handleDeleteClick = async (pos: JobPositionRead) => {
    try {
      setDeletingId(pos.id);
      setDeleteError(null);
      await adminJobPositionService.deletePosition(pos.id);
      fetchPositions();
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
    setSelectedPosition(null);
    setShowModal(true);
  };

  const handleEditClick = (pos: JobPositionRead) => {
    setSelectedPosition(pos);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedPosition(null);
  };

  const renderFormattedError = (error: string | null) => {
    if (!error) return null;

    const jobMatch = error.match(/active job\(s\): \[(.*?)\]/i);
    if (!jobMatch) return error;

    const mainMessage = error.split(/active job\(s\):/i)[0].trim();
    const jobNamesStr = jobMatch[1];

    const jobNames = jobNamesStr
      .split(",")
      .map((name) => {
        let trimmed = name.trim();
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
          className="hover:bg-transparent p-0 font-semibold"
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold">
          Created Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
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
          className="hover:bg-transparent p-0 font-semibold">
          Updated Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <DateDisplay date={row.original.updated_at} showIcon />
      )
    },
    {
      id: "actions",
      header: () => (
        <div className="flex items-center justify-end pr-4">
          <span className="font-semibold">
            Actions
          </span>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
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
                  >
                    <Edit2 className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Edit</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
                <span className="text-primary">Edit Position</span>
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
                    className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center justify-center shrink-0"
                  >
                    <Trash2Icon className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Delete</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
                <span className="text-destructive">Delete Position</span>
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
        <ErrorDisplay message={error} onRetry={fetchPositions} />
      ) : (
        <DataTable
          columns={columns}
          data={positions}
          loading={loading}
          searchKey="name"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Filter positions by name..."
          initialSorting={[{ id: "name", desc: false }]}
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

      <PositionModal
        show={showModal}
        handleClose={handleCloseModal}
        onPositionSaved={fetchPositions}
        position={selectedPosition}
      />

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
};

export default AdminJobPositions;
