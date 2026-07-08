import { lazy } from "react";
import { type RouteObject, Outlet } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { adminGuidelinesLoader } from "@/loaders/adminGuidelines";
import { guidelineFormLoader } from "@/loaders/guidelineForm";

const AdminGuidelines = lazy(() => import("@/pages/terms-conditions/index"));
const AdminGuidelineForm = lazy(() => import("@/pages/terms-conditions/form"));

export const guidelineRoutes: RouteObject = {
  path: "settings/terms-conditions",
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.ADMIN_ACCESS}>
      <Outlet />
    </RoleRoute>
  ),
  children: [
    {
      index: true,
      element: <AdminGuidelines />,
      loader: adminGuidelinesLoader,
    },
    {
      path: "new",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.ADMIN_ACCESS}>
          <AdminGuidelineForm />
        </RoleRoute>
      ),
    },
    {
      path: ":slug/edit",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.ADMIN_ACCESS}>
          <AdminGuidelineForm />
        </RoleRoute>
      ),
      loader: guidelineFormLoader,
    },
  ],
};
