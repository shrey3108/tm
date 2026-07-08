/**
 * @module AdminUsers
 * @component AdminUsers
 *
 * Admin page for managing users.
 * Displays all users with ability to create new users.
 */

import { useState, useEffect } from "react";
import type { UserAdminRead } from "@/types/permission-role";
import AppPageShell from "@/components/shared/AppPageShell";
import { DateDisplay } from "@/components/shared/DateDisplay";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/ToastProvider";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { DataTable } from "@/components/shared/DataTable";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { UserTableFilters } from "@/components/admin/UserTableFilters";
import { useUserTableFilters } from "@/hooks/useUserTableFilters";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Edit2, Trash2, Plus } from "lucide-react";

import { useAuth } from "@/store/hooks";
import { useAdminUsers } from "@/hooks/queries/admin/useAdminUsers";
import { useDeleteUserMutation } from "@/hooks/mutations/admin/useUser";
import DeleteModal from "@/components/modal/DeleteModal";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { useDeleteConfirmation } from "@/hooks/useDeleteConfirmation";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";

export default function AdminUsers() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserAdminRead[]>([]);

  const {
    searchFilter,
    setSearchFilter,
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter,
    dateRange,
    setDateRange,
    roleOptions,
    filteredUsers,
    hasActiveFilters,
    clearFilters,
    minDate,
    pagination,
    setPagination,
  } = useUserTableFilters(users, "adminUsers");

  const { pageIndex, pageSize } = pagination;

  const debouncedSearch = useDebouncedValue(searchFilter);

  const { data: queryUsers, total, loading, error, refetch } = useAdminUsers({
    skip: pageIndex * pageSize,
    limit: pageSize,
    q: debouncedSearch,
  });

  useEffect(() => {
    setUsers(queryUsers);
  }, [queryUsers]);

  const handleSearchChange = (value: string) => {
    setSearchFilter(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const deleteUserMutation = useDeleteUserMutation();

  const {
    showModal: showDeleteModal,
    handleDeleteClick,
    handleClose: handleCloseDelete,
    handleConfirm: handleConfirmDelete,
    isDeleting,
    error: deleteError,
    message: deleteMessage,
  } = useDeleteConfirmation<UserAdminRead>({
    mutation: deleteUserMutation,
    onSuccess: () => {
      toast.success("User deleted successfully");
    },
    itemTitle: (user) => `user "${user.full_name || user.email}"`,
  });

  const handleCreateClick = () => {
    navigate("/dashboard/admin/users/new");
  };

  const handleEditClick = (user: UserAdminRead) => {
    navigate(`/dashboard/admin/users/${slugify(user.full_name || user.email)}/edit`, { state: { user } });
  };

  const columns: ColumnDef<UserAdminRead>[] = [
    {
      accessorKey: "full_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Full Name
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span>{row.original.full_name || "N/A"}</span>,
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Email
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "is_active",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Status
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <StatusBadge status={row.original.is_active} />,
    },
    {
      accessorKey: "role_name",
      header: () => (
        <div className="">
          <span className="font-semibold text-base">Role Name</span>
        </div>
      ),
      cell: ({ row }) => (
        <span>
          {row.original.role_name || "N/A"}
        </span>
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
      cell: ({ row }) => <DateDisplay date={row.original.created_at} showTime={false} />,
    },
    {
      id: "actions",
      header: () => <div className="flex items-center justify-center ">Actions</div>,
      cell: ({ row }) => {
        const user = row.original;
        return (
          currentUser && (
            <div className="flex items-center justify-center gap-0.5 flex-nowrap">
              {user.full_name !== "System Admin" && user.role_name.toLowerCase() !== "super admin" && (
                <PermissionGuard permissions={PERMISSIONS.USERS_MANAGE} hideWhenDenied>
                  <HoverCard>
                    <HoverCardTrigger
                      render={(props) => (
                        <Button
                          {...props}
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                          onClick={() => handleEditClick(user)}
                          disabled={currentUser && currentUser.id === user.id}
                        >
                          <Edit2 className="h-4 w-4 shrink-0" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      )}
                    />
                    <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                      Edit User
                    </HoverCardContent>
                  </HoverCard>
                </PermissionGuard>
              )}
              {user.full_name !== "System Admin" && user.role_name.toLowerCase() !== "super admin" && (
                <PermissionGuard permissions={PERMISSIONS.USERS_MANAGE} hideWhenDenied>
                  <HoverCard>
                    <HoverCardTrigger
                      render={(props) => (
                        <Button
                          {...props}
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                          onClick={() => handleDeleteClick(user)}
                          disabled={(currentUser && currentUser.id === user.id) || row.original.is_active}
                        >
                          <Trash2 className="h-4 w-4 shrink-0" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      )}
                    />
                    <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                      Delete User
                    </HoverCardContent>
                  </HoverCard>
                </PermissionGuard>
              )}
            </div>
          )
        );
      },
    },
  ];

  return (
    <AppPageShell width="wide">
      <PageHeader
        title="User Management"
        breadcrumbActions={
          <PermissionGuard permissions={PERMISSIONS.USERS_MANAGE} hideWhenDenied>
            <Button onClick={handleCreateClick} size={"sm"} className="gap-2">
              <Plus className="h-4 w-4" />
              Create User
            </Button>
          </PermissionGuard>
        }
      />

      {error && !users.length ? (
        <ErrorDisplay message={error.message} onRetry={refetch} />
      ) : (
        <div className="space-y-4">
          <UserTableFilters
            searchFilter={searchFilter}
            setSearchFilter={handleSearchChange}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            roleFilter={roleFilter}
            setRoleFilter={setRoleFilter}
            dateRange={dateRange}
            setDateRange={setDateRange}
            roleOptions={roleOptions}
            hasActiveFilters={hasActiveFilters}
            clearFilters={clearFilters}
            resultCount={filteredUsers.length}
            totalCount={total}
            minDate={minDate}
          />
          <DataTable
            columns={columns}
            data={filteredUsers}
            loading={loading}
            initialSorting={[
              { id: "is_active", desc: true },
              { id: "created_at", desc: true },
            ]}
            isServerSide={true}
            pageIndex={pageIndex}
            pageSize={pageSize}
            pageCount={Math.ceil((total || 0) / pageSize)}
            onPaginationChange={setPagination}
          />
        </div>
      )}

      <DeleteModal
        show={showDeleteModal}
        handleClose={handleCloseDelete}
        handleConfirm={handleConfirmDelete}
        title="Delete User"
        message={deleteMessage}
        isLoading={isDeleting}
        error={deleteError}
      />
    </AppPageShell>
  );
}
