import { lazy } from "react";
import { type RouteObject, Outlet } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";

const AdminDesignations = lazy(() => import("@/pages/designations/index"));
const AdminDesignationForm = lazy(() => import("@/pages/designations/form"));

export const designationRoutes: RouteObject = {
  path: "designations",
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.ASSOCIATES_ACCESS}>
      <Outlet />
    </RoleRoute>
  ),
  children: [
    {
      index: true,
      element: <AdminDesignations />,
    },
    {
      path: "new",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.ASSOCIATES_MANAGE}>
          <AdminDesignationForm />
        </RoleRoute>
      ),
    },
    {
      path: ":slug/edit",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.ASSOCIATES_MANAGE}>
          <AdminDesignationForm />
        </RoleRoute>
      ),
    },
  ],
};
