import { lazy } from "react";
import { type RouteObject, Outlet } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { priorityFormLoader } from "@/loaders/priorityForm";
import { adminJobPrioritiesLoader } from "@/loaders/adminJobPriorities";

const AdminJobPriorities = lazy(() => import("@/pages/priorities/index"));
const AdminPriorityForm = lazy(() => import("@/pages/priorities/form"));

export const priorityRoutes: RouteObject = {
  path: "settings/priorities",
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.ADMIN_ACCESS}>
      <Outlet />
    </RoleRoute>
  ),
  children: [
    {
      index: true,
      element: <AdminJobPriorities />,
      loader: adminJobPrioritiesLoader,
    },
    {
      path: "new",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.ADMIN_ACCESS}>
          <AdminPriorityForm />
        </RoleRoute>
      ),
    },
    {
      path: ":slug/edit",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.ADMIN_ACCESS}>
          <AdminPriorityForm />
        </RoleRoute>
      ),
      loader: priorityFormLoader,
    },
  ],
};
