import { lazy } from "react";
import { type RouteObject } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { adminAuditLogsLoader } from "@/loaders/adminAuditLogs";

const AdminAuditLogs = lazy(() => import("@/pages/Admin/AdminAuditLogs"));

export const auditLogRoutes: RouteObject = {
  path: "audit-logs",
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.AUDIT_READ}>
      <AdminAuditLogs />
    </RoleRoute>
  ),
  loader: adminAuditLogsLoader,
};
