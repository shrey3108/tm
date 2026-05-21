/**
 * Admin page for managing roles and permissions.
 * Displays all roles and permissions with ability to create new permissions.
 */

import { useCallback, useState } from "react";
import { adminPermissionService, adminRoleService } from "@/apis/admin";
import type { PermissionRead, RoleRead } from "@/types/admin";
import { DataTable } from "@/components/shared/DataTable";
import type { ColumnDef } from "@tanstack/react-table";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import AppPageShell from "@/components/shared/AppPageShell";
import { DateDisplay } from "@/components/shared/DateDisplay";
import PageHeader from "@/components/shared/PageHeader";
import { CreatePermissionModal, DeleteModal, RoleModal } from "@/components/modal";
import { useAdminData, useDeleteConfirmation } from "@/hooks";
import { Button } from "@/components/ui/button";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { useAuth } from "@/store/hooks";
import { Plus } from "lucide-react";

const AdminRoles = () => {
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [roles, permissions] = await Promise.all([
      (await adminRoleService.getAllRoles()).data,
      (await adminPermissionService.getAllPermissions()).data,
    ]);
    return { roles, permissions };
  }, []);

  const {
    data: combinedData,
    loading,
    error,
    fetchData,
  } = useAdminData<{ roles: RoleRead[]; permissions: PermissionRead[] }>(
    async () => {
      const data = await fetchAll();
      return [data]; // useAdminData expects an array
    },
    { initialData: [{ roles: [], permissions: [] }] },
  );

  const roles = combinedData[0]?.roles || [];
  // const permissions = combinedData[0]?.permissions || [];
  const { user: currentUser } = useAuth();

  // Two separate delete hooks for clarity.
  const roleDelete = useDeleteConfirmation<RoleRead>({
    deleteFn: (id) => adminRoleService.deleteRole(id as string),
    onSuccess: fetchData,
    itemTitle: (role) => `role "${role.name}"`,
  });

  const permissionDelete = useDeleteConfirmation<PermissionRead>({
    deleteFn: (id) => adminPermissionService.deletePermission(id as string),
    onSuccess: fetchData,
    itemTitle: (perm) => `permission "${perm.name}"`,
  });

  const handleCreateRole = () => {
    setEditingRoleId(null);
    setShowRoleModal(true);
  };

  const handleEditRole = (roleId: string) => {
    setEditingRoleId(roleId);
    setShowRoleModal(true);
  };

  const roleColumns: ColumnDef<RoleRead>[] = [
    {
      accessorKey: "name",
      header: () => (
        <div className="text-left font-semibold">Role Name</div>
      ),
      cell: ({ row }) => <div className="text-left">{row.original.name}</div>,
    },
    {
      accessorKey: "created_at",
      header: () => (
        <div className="text-center font-semibold">Created At</div>
      ),
      cell: ({ row }) =>
        <div className="text-center">
          <DateDisplay date={row.original.created_at} showTime={false} />
        </div>
    },
    {
      accessorKey: "user_count",
      header: () => (
        <div className="text-center font-semibold">Users Count</div>
      ),
      cell: ({ row }) => <div className="text-center">
        {row.original.user_count}
      </div>,
    },
    {
      id: "actions",
      header: () => (
        <div className="text-center font-semibold">Actions</div>
      ),
      cell: ({ row }) => {
        const role = row.original;
        return (

          <div className="flex items-center justify-center">
            {currentUser && role.name.toLocaleLowerCase() !== "superadmin" && (
              <>
                <PermissionGuard permissions={PERMISSIONS.ROLES_MANAGE} hideWhenDenied>
                  <Button
                    variant="outline"
                    size="sm"
                    className="me-2"
                    onClick={() => handleEditRole(role.id)}
                    disabled={currentUser.role_id === role.id}
                  >
                    Edit
                  </Button>
                </PermissionGuard>
                <PermissionGuard permissions={PERMISSIONS.ROLES_MANAGE} hideWhenDenied>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => roleDelete.handleDeleteClick(role)}
                    disabled={currentUser.role_id === role.id || role?.user_count > 0}
                  >
                    Delete
                  </Button>
                </PermissionGuard>
              </>
            )}
          </div>

        );
      },
    },
  ];

  // const permissionColumns: ColumnDef<PermissionRead>[] = [
  //   {
  //     accessorKey: "name",
  //     header: () => (
  //       <div className="text-center font-semibold">Name</div>
  //     ),
  //     cell: ({ row }) => {
  //       const perm = row.original;
  //       return (
  //         <>
  //           <code>{perm.name}</code>
  //           <div className="text-muted-foreground text-sm">{perm.description}</div>
  //         </>
  //       );
  //     },
  //   },
  //   {
  //     id: "actions",
  //     header: () => (
  //       <div className="text-center font-semibold">Actions</div>
  //     ),
  //     cell: ({ row }) => (
  //       <PermissionGuard permissions={PERMISSIONS.PERMISSIONS_MANAGE} hideWhenDenied>
  //         <Button
  //           variant="destructive"
  //           size="sm"
  //           onClick={() => permissionDelete.handleDeleteClick(row.original)}
  //         >
  //           Delete
  //         </Button>
  //       </PermissionGuard>
  //     ),
  //   },
  // ];

  return (
    <AppPageShell width="wide">
      <PageHeader
        title="Role & Permission Management"

        breadcrumbActions={
          <>
            {/* <PermissionGuard permissions={PERMISSIONS.PERMISSIONS_MANAGE} hideWhenDenied>
            <Button variant="outline" onClick={() => setShowPermissionModal(true)}>
              Create Permission
            </Button>
          </PermissionGuard> */}
            <PermissionGuard permissions={PERMISSIONS.ROLES_MANAGE} hideWhenDenied>
              <Button onClick={handleCreateRole} size={"sm"} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Role</Button>
            </PermissionGuard>
          </>
        }
      />

      {error && !roles.length ? (
        <ErrorDisplay message={error} onRetry={fetchData} />
      ) : (
        <div className="flex flex-col gap-8">
          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">Roles</h2>
            <DataTable
              columns={roleColumns}
              data={roles}
              loading={loading}
              emptyMessage="No roles found."
            />
          </div>

          {/* <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">Permissions</h2>
            <DataTable
              columns={permissionColumns}
              data={permissions}
              loading={loading}
              emptyMessage="No permissions found."
            />
          </div> */}
        </div>
      )}

      <CreatePermissionModal
        show={showPermissionModal}
        handleClose={() => setShowPermissionModal(false)}
        onPermissionCreated={fetchData}
      />

      <RoleModal
        show={showRoleModal}
        handleClose={() => setShowRoleModal(false)}
        onSuccess={fetchData}
        editRoleId={editingRoleId}
      />

      <DeleteModal
        show={roleDelete.showModal}
        handleClose={roleDelete.handleClose}
        handleConfirm={roleDelete.handleConfirm}
        title="Delete Role"
        message={roleDelete.message}
        isLoading={roleDelete.isDeleting}
        error={roleDelete.error}
      />

      <DeleteModal
        show={permissionDelete.showModal}
        handleClose={permissionDelete.handleClose}
        handleConfirm={permissionDelete.handleConfirm}
        title="Delete Permission"
        message={permissionDelete.message}
        isLoading={permissionDelete.isDeleting}
        error={permissionDelete.error}
      />
    </AppPageShell>
  );
};

export default AdminRoles;
