import { lazy } from "react";
import { type RouteObject, Outlet } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { adminJobCriteriaLoader } from "@/loaders/adminJobCriteria";
import { adminJobCriteriaFormLoader } from "@/loaders/adminJobCriteriaForm";
import { adminJobStagesLoader } from "@/loaders/adminJobStages";
import { adminJobStageFormLoader } from "@/loaders/adminJobStageForm";

const AdminJobCriteria = lazy(() => import("@/pages/Admin/AdminJobCriteria"));
const AdminJobCriteriaForm = lazy(() => import("@/pages/Admin/AdminJobCriteriaForm"));
const AdminJobStages = lazy(() => import("@/pages/Admin/AdminJobStages"));
const AdminJobStageForm = lazy(() => import("@/pages/Admin/AdminJobStageForm"));

export const criteriaStagesRoutes: RouteObject = {
  path: "criteria-stages",
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.ADMIN_ALL}>
      <Outlet />
    </RoleRoute>
  ),
  children: [
    {
      path: "criteria",
      element: <AdminJobCriteria />,
      loader: adminJobCriteriaLoader,
    },
    {
      path: "criteria/new",
      element: <AdminJobCriteriaForm />,
      loader: adminJobCriteriaFormLoader,
    },
    {
      path: "criteria/:slug/edit",
      element: <AdminJobCriteriaForm />,
      loader: adminJobCriteriaFormLoader,
    },
    {
      path: "stages",
      element: <AdminJobStages />,
      loader: adminJobStagesLoader,
    },
    {
      path: "stages/new",
      element: <AdminJobStageForm />,
      loader: adminJobStageFormLoader,
    },
    {
      path: "stages/:slug/edit",
      element: <AdminJobStageForm />,
      loader: adminJobStageFormLoader,
    },
  ],
};
