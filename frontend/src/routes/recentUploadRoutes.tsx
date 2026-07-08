import { lazy } from "react";
import { type RouteObject } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { adminRecentUploadsLoader } from "@/loaders/adminRecentUploads";

const AdminRecentUploads = lazy(() => import("@/pages/Admin/AdminRecentUploads"));

export const recentUploadRoutes: RouteObject = {
  path: "recent-uploads",
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.FILES_READ}>
      <AdminRecentUploads />
    </RoleRoute>
  ),
  loader: adminRecentUploadsLoader,
};
