/**
 * Application route configuration.
 * Defines all routes for the hiring platform with public/protected access control using React Router Data Mode.
 * Lazy loading is applied to large/admin-only sections to reduce initial bundle size.
 */

import { lazy } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import RouteErrorBoundary from "@/components/shared/RouteErrorBoundary";
import { RootLayout } from "@/components/layout/RootLayout";

// Sub-Routes Imports
import { authRoutes } from "./authRoutes";
import { jobBoardRoutes } from "./jobBoardRoutes";
import { questionsBankRoutes } from "./questionsBankRoutes";
import { skillRoutes } from "./skillRoutes";
import { departmentRoutes } from "./departmentRoutes";
import { priorityRoutes } from "./priorityRoutes";
import { guidelineRoutes } from "./guidelineRoutes";
import { positionRoutes } from "./positionRoutes";
import { associateRoutes } from "./associateRoutes";
import { userRoutes } from "./userRoutes";
import { roleRoutes } from "./roleRoutes";
import { dashboardRoutes } from "./dashboardRoutes";
import { auditLogRoutes } from "./auditLogRoutes";
import { recentUploadRoutes } from "./recentUploadRoutes";
import { jobRoutes } from "./jobRoutes";
import { criteriaStagesRoutes } from "./criteriaStagesRoutes";
import { promptRoutes } from "./promptRoutes";

const DashboardLayout = lazy(() => import("@/components/layout/DashboardLayout"));

/**
 * React Router Browser Router configuration.
 * Defines public, protected, and role-based routes with corresponding loaders.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      ...authRoutes,
      {
        path: "",
        element: (
          <ProtectedRoute>
            <Navigate to="/dashboard" replace />
          </ProtectedRoute>
        ),
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="jobs" replace />,
          },
          jobBoardRoutes,
          questionsBankRoutes,
          {
            path: "admin",
            element: (
              <RoleRoute
                requiredPermissions={[
                  PERMISSIONS.ADMIN_ACCESS,
                  PERMISSIONS.ANALYTICS_READ,
                  PERMISSIONS.AUDIT_READ,
                  PERMISSIONS.CANDIDATES_ACCESS,
                  PERMISSIONS.DEPARTMENTS_ACCESS,
                  PERMISSIONS.FILES_READ,
                  PERMISSIONS.JOBS_ACCESS,
                  PERMISSIONS.ROLES_READ,
                  PERMISSIONS.SKILLS_ACCESS,
                  PERMISSIONS.USERS_READ,
                ]}
              >
                <Outlet />
              </RoleRoute>
            ),
            children: [
              dashboardRoutes,
              userRoutes,
              roleRoutes,
              auditLogRoutes,
              recentUploadRoutes,
              ...jobRoutes,
              skillRoutes,
              associateRoutes,
              departmentRoutes,
              positionRoutes,
              criteriaStagesRoutes,
              priorityRoutes,
              promptRoutes,
              guidelineRoutes,
            ],
          },
        ],
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
