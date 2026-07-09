import { lazy } from "react";
import { type RouteObject, Outlet } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { adminJobCriteriaLoader } from "@/loaders/adminJobCriteria";
import { adminJobCriteriaFormLoader } from "@/loaders/adminJobCriteriaForm";
import { adminJobStagesLoader } from "@/loaders/adminJobStages";
import { adminJobStageFormLoader } from "@/loaders/adminJobStageForm";

const AdminJobCriteria = lazy(() => import("@/pages/criteria/index"));
const AdminJobCriteriaForm = lazy(() => import("@/pages/criteria/form"));
const AdminJobStages = lazy(() => import("@/pages/stages/index"));
const AdminJobStageForm = lazy(() => import("@/pages/stages/form"));

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
