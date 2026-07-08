import { lazy } from "react";
import { type RouteObject, Outlet } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { adminRolesLoader } from "@/loaders/adminRoles";
import { roleFormLoader } from "@/loaders/roleForm";

const AdminRoles = lazy(() => import("@/pages/roles/index"));
const AdminRoleForm = lazy(() => import("@/pages/roles/form"));

export const roleRoutes: RouteObject = {
  path: "roles",
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.ROLES_READ}>
      <Outlet />
    </RoleRoute>
  ),
  children: [
    {
      index: true,
      element: <AdminRoles />,
      loader: adminRolesLoader,
    },
    {
      path: "new",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.ROLES_MANAGE}>
          <AdminRoleForm />
        </RoleRoute>
      ),
    },
    {
      path: ":slug/edit",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.ROLES_MANAGE}>
          <AdminRoleForm />
        </RoleRoute>
      ),
      loader: roleFormLoader,
    },
  ],
};
