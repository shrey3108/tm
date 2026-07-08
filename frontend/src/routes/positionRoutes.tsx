import { lazy } from "react";
import { type RouteObject, Outlet } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { adminJobPositionsLoader } from "@/loaders/adminJobPositions";
import { positionFormLoader } from "@/loaders/positionForm";

const AdminJobPositions = lazy(() => import("@/pages/positions/index"));
const AdminPositionForm = lazy(() => import("@/pages/positions/form"));

export const positionRoutes: RouteObject = {
  path: "criteria-stages/positions",
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.ADMIN_ALL}>
      <Outlet />
    </RoleRoute>
  ),
  children: [
    {
      index: true,
      element: <AdminJobPositions />,
      loader: adminJobPositionsLoader,
    },
    {
      path: "new",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.ADMIN_ALL}>
          <AdminPositionForm />
        </RoleRoute>
      ),
    },
    {
      path: ":slug/edit",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.ADMIN_ALL}>
          <AdminPositionForm />
        </RoleRoute>
      ),
      loader: positionFormLoader,
    },
  ],
};
