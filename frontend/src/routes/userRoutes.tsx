import { lazy } from "react";
import { type RouteObject, Outlet } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { adminUsersLoader } from "@/loaders/adminUsers";
import { userFormLoader } from "@/loaders/userForm";

const AdminUsers = lazy(() => import("@/pages/users/index"));
const AdminUserForm = lazy(() => import("@/pages/users/form"));

export const userRoutes: RouteObject = {
  path: "users",
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.USERS_READ}>
      <Outlet />
    </RoleRoute>
  ),
  children: [
    {
      index: true,
      element: <AdminUsers />,
      loader: adminUsersLoader,
    },
    {
      path: "new",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.USERS_MANAGE}>
          <AdminUserForm />
        </RoleRoute>
      ),
    },
    {
      path: ":slug/edit",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.USERS_MANAGE}>
          <AdminUserForm />
        </RoleRoute>
      ),
      loader: userFormLoader,
    },
  ],
};
