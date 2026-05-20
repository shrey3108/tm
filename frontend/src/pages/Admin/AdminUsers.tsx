/**
 * Admin page for managing users.
 * Displays all users with ability to create new users.
 */

import { useState, useEffect } from "react";
import { adminUserService } from "@/apis/admin";
import type { UserAdminRead } from "@/types/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import { DateDisplay } from "@/components/shared/DateDisplay";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/ToastProvider";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { DataTable } from "@/components/shared/DataTable";
import {
  CreateUserModal,
  // CreateUserModal,
  DeleteModal
} from "@/components/modal";
import { useAdminData, useDebouncedValue, useDeleteConfirmation } from "@/hooks";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { UserTableFilters } from "./components/UserTableFilters";
import { useUserTableFilters } from "@/hooks/useUserTableFilters";

import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components";
import { useAuth } from "@/store/hooks";

const AdminUsers = () => {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAdminRead | null>(null);

  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const {
    data: users,
    total,
    loading,
    error,
    fetchData: fetchUsers,
  } = useAdminData<UserAdminRead>(
    () => adminUserService.getAllUsers(pageIndex * pageSize, pageSize, debouncedSearch),
    { fetchOnMount: false }
  );

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
  } = useUserTableFilters(users);

  const debouncedSearch = useDebouncedValue(searchFilter)
  const { user: currentUser } = useAuth();

  // Reset to first page when search changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch]);



  // Refetch when pagination or search changes
  useEffect(() => {
    fetchUsers();
  }, [pageIndex, pageSize, debouncedSearch, fetchUsers]);

  const {
    showModal: showDeleteModal,
    handleDeleteClick,
    handleClose: handleCloseDelete,
    handleConfirm: handleConfirmDelete,
    isDeleting,
    error: deleteError,
    message: deleteMessage,
  } = useDeleteConfirmation<UserAdminRead>({
    deleteFn: (id) => adminUserService.deleteUser(id as string),
    onSuccess: () => {
      fetchUsers();
      toast.success("User deleted successfully");
    },
    itemTitle: (user) => `user "${user.full_name || user.email}"`,
  });

  /*
  const handleCreateClick = () => {
    setSelectedUser(null);
    setShowModal(true);
  };
  */

  const handleEditClick = (user: UserAdminRead) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
  };

  const columns: ColumnDef<UserAdminRead>[] = [
    {
      accessorKey: "full_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold"
        >
          Full Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
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
          className="hover:bg-transparent p-0 font-semibold"
        >
          Email
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "is_active",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold"
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <StatusBadge status={row.original.is_active} />,
    },
    {
      accessorKey: "role_name",
      header: "Role Name",
      cell: ({ row }) => (
        <small
          className="font-semibold"
          title={row.original.role_name || "N/A"}
        >
          {row.original.role_name || "N/A"}
        </small>
      ),
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold"
        >
          Created At
          <ArrowUpDown className="ml-2 h-4 w-4" />
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
          (currentUser && < div className="flex items-center justify-center gap-2 flex-nowrap" >
            {user.full_name !== "System Admin" && user.role_name.toLowerCase() !== "super admin" && <PermissionGuard permissions={PERMISSIONS.USERS_MANAGE} hideWhenDenied>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => handleEditClick(user)}
                disabled={currentUser && currentUser.id === user.id}
              >
                Edit
              </Button>
            </PermissionGuard>}
            {
              user.full_name !== "System Admin" && user.role_name.toLowerCase() !== "super admin" && (
                <PermissionGuard permissions={PERMISSIONS.USERS_MANAGE} hideWhenDenied>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="shrink-0"
                    onClick={() => handleDeleteClick(user)}
                    disabled={currentUser && currentUser.id === user.id || row.original.is_active}
                  >
                    Delete
                  </Button>
                </PermissionGuard>
              )
            }
          </div >)
        );
      },
    },
  ];

  return (
    <AppPageShell width="wide">
      <PageHeader
        title="User Management"
      // breadcrumbActions={
      //   <PermissionGuard permissions={PERMISSIONS.USERS_MANAGE} hideWhenDenied>
      //     <Button onClick={handleCreateClick} size={"sm"}>Create User</Button>
      //   </PermissionGuard>
      // }
      />

      {error && !users.length ? (
        <ErrorDisplay message={error} onRetry={fetchUsers} />
      ) : (
        <div className="space-y-4">
          <UserTableFilters
            searchFilter={searchFilter}
            setSearchFilter={setSearchFilter}
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

      <CreateUserModal
        show={showModal}
        handleClose={handleCloseModal}
        onUserSaved={fetchUsers}
        user={selectedUser}
      />

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
};

export default AdminUsers;
