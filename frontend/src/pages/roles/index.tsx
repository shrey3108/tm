/**
 * @module AdminRoles
 * @component AdminRoles
 *
 * Admin page for managing roles and permissions.
 * Displays all roles and permissions with ability to create new permissions.
 */

import { useEffect, useState } from "react";
import type { RoleRead } from "@/types/permission-role";
import { useDeleteRoleMutation } from "@/hooks/mutations/admin/useRole";
import { DataTable } from "@/components/shared/DataTable";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import AppPageShell from "@/components/shared/AppPageShell";
import { DateDisplay } from "@/components/shared/DateDisplay";
import PageHeader from "@/components/shared/PageHeader";

import { Button } from "@/components/ui/button";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { useAuth } from "@/store/hooks";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { useAdminRoles } from "@/hooks/queries/admin/useAdminRoles";
import { usePageFilters } from "@/hooks/usePageFilters";
import DeleteModal from "@/components/modal/DeleteModal";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { useDeleteConfirmation } from "@/hooks/useDeleteConfirmation";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";

export default function AdminRoles() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const { filters, setFilters } = usePageFilters("adminRoles", {
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

  const debouncedSearch = useDebouncedValue(search);

  const { data: roles, total, loading, error, refetch } = useAdminRoles({
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

  const deleteRoleMutation = useDeleteRoleMutation();

  const roleDelete = useDeleteConfirmation<RoleRead>({
    mutation: deleteRoleMutation,
    itemTitle: (role) => `role "${role.name}"`,
  });

  const handleCreateRole = () => {
    navigate("/dashboard/admin/roles/new");
  };

  const handleEditRole = (role: RoleRead) => {
    navigate(`/dashboard/admin/roles/${slugify(role.name)}/edit`, { state: { role } });
  };

  const roleColumns: ColumnDef<RoleRead>[] = [
    {
      accessorKey: "name",
      header: () => (
        <div className="text-left text-base">Role Name</div>
      ),
      cell: ({ row }) => <div className="text-left">{row.original.name}</div>,
    },
    {
      accessorKey: "created_at",
      header: () => (
        <div className="text-center text-base">Created At</div>
      ),
      cell: ({ row }) => (
        <div className="text-center">
          <DateDisplay date={row.original.created_at} showTime={false} />
        </div>
      )
    },
    {
      accessorKey: "user_count",
      header: () => (
        <div className="text-center text-base">Users Count</div>
      ),
      cell: ({ row }) => (
        <div className="text-center">
          {row.original.user_count}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => (
        <div className="text-center text-base">Actions</div>
      ),
      cell: ({ row }) => {
        const role = row.original;
        return (
          <div className="flex items-center justify-center gap-0.5">
            {currentUser && role.name.toLocaleLowerCase() !== "superadmin" && (
              <>
                <PermissionGuard permissions={PERMISSIONS.ROLES_MANAGE} hideWhenDenied>
                  <HoverCard>
                    <HoverCardTrigger
                      render={(props) => (
                        <Button
                          {...props}
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                          onClick={() => handleEditRole(role)}
                          disabled={currentUser.role_id === role.id}
                        >
                          <Edit2 className="h-4 w-4 shrink-0" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      )}
                    />
                    <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                      Edit Role
                    </HoverCardContent>
                  </HoverCard>
                </PermissionGuard>
                <PermissionGuard permissions={PERMISSIONS.ROLES_MANAGE} hideWhenDenied>
                  <HoverCard>
                    <HoverCardTrigger
                      render={(props) => (
                        <Button
                          {...props}
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                          onClick={() => roleDelete.handleDeleteClick(role)}
                          disabled={currentUser.role_id === role.id || role?.user_count > 0}
                        >
                          <Trash2 className="h-4 w-4 shrink-0" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      )}
                    />
                    <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                      Delete Role
                    </HoverCardContent>
                  </HoverCard>
                </PermissionGuard>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <AppPageShell width="wide">
      <PageHeader
        title="Role & Permission Management"
        breadcrumbActions={
          <PermissionGuard permissions={PERMISSIONS.ROLES_MANAGE} hideWhenDenied>
            <Button onClick={handleCreateRole} size={"sm"} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Role
            </Button>
          </PermissionGuard>
        }
      />

      {error && !roles.length ? (
        <ErrorDisplay message={error.message} onRetry={refetch} />
      ) : (
        <div className="flex flex-col gap-8">
          <div className="space-y-4">
            <DataTable
              columns={roleColumns}
              data={roles}
              loading={loading}
              searchKey="name"
              searchPlaceholder="Filter roles by name..."
              searchValue={search}
              onSearchChange={handleSearchChange}
              isServerSide={true}
              pageIndex={pageIndex}
              pageSize={pageSize}
              pageCount={Math.ceil(total / pageSize)}
              onPaginationChange={setPagination}
              totalRecords={total}
              totalCount={overallTotal}
              resultCount={roles.length}
              entityName="Roles"
            />
          </div>
        </div>
      )}

      <DeleteModal
        show={roleDelete.showModal}
        handleClose={roleDelete.handleClose}
        handleConfirm={roleDelete.handleConfirm}
        title="Delete Role"
        message={roleDelete.message}
        isLoading={roleDelete.isDeleting}
        error={roleDelete.error}
      />
    </AppPageShell>
  );
}
