import { lazy } from "react";
import { type RouteObject } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";

const AdminPrompts = lazy(() => import("@/pages/Admin/settings/AdminPrompts"));

export const promptRoutes: RouteObject = {
  path: "settings/prompts",
  element: (
    <RoleRoute requiredPermissions={[PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.ANALYTICS_READ]}>
      <AdminPrompts />
    </RoleRoute>
  ),
};
