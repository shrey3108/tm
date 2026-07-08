import { lazy } from "react";
import { type RouteObject, Outlet } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { adminAssociatesLoader } from "@/loaders/adminAssociates";
import { associateFormLoader } from "@/loaders/associateForm";

const AdminAssociates = lazy(() => import("@/pages/associates/index"));
const AdminAssociateForm = lazy(() => import("@/pages/associates/form"));

export const associateRoutes: RouteObject = {
  path: "associates",
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.ASSOCIATES_ACCESS}>
      <Outlet />
    </RoleRoute>
  ),
  children: [
    {
      index: true,
      element: <AdminAssociates />,
      loader: adminAssociatesLoader,
    },
    {
      path: "new",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.ASSOCIATES_MANAGE}>
          <AdminAssociateForm />
        </RoleRoute>
      ),
    },
    {
      path: ":slug/edit",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.ASSOCIATES_MANAGE}>
          <AdminAssociateForm />
        </RoleRoute>
      ),
      loader: associateFormLoader,
    },
  ],
};
