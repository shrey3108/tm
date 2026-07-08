import { lazy } from "react";
import { type RouteObject } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { adminJobsLoader } from "@/loaders/adminJobs";
import { adminCandidateSearchLoader } from "@/loaders/adminCandidateSearch";

const AdminJobs = lazy(() => import("@/pages/Admin/AdminJobs"));
const AdminCandidateSearch = lazy(() => import("@/pages/Admin/AdminCandidateSearch"));

export const jobRoutes: RouteObject[] = [
  {
    path: "jobs",
    element: (
      <RoleRoute requiredPermissions={PERMISSIONS.JOBS_ACCESS}>
        <AdminJobs />
      </RoleRoute>
    ),
    loader: adminJobsLoader,
  },
  {
    path: "jobs/:jobId/candidates",
    element: (
      <RoleRoute requiredPermissions={PERMISSIONS.CANDIDATES_ACCESS}>
        <AdminCandidateSearch />
      </RoleRoute>
    ),
    loader: adminCandidateSearchLoader,
  },
  {
    path: "candidates",
    element: (
      <RoleRoute requiredPermissions={PERMISSIONS.CANDIDATES_ACCESS}>
        <AdminCandidateSearch />
      </RoleRoute>
    ),
    loader: adminCandidateSearchLoader,
  },
];
