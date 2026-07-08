import { lazy } from "react";
import { type RouteObject } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { adminDashboardLoader } from "@/loaders/adminDashboard";

const AdminDashboard = lazy(() => import("@/pages/Admin/AdminDashboard"));

export const dashboardRoutes: RouteObject = {
  index: true,
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.ANALYTICS_READ}>
      <AdminDashboard />
    </RoleRoute>
  ),
  loader: adminDashboardLoader,
};
