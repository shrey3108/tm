import { lazy } from "react";
import { type RouteObject, Outlet } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { adminDepartmentsLoader } from "@/loaders/adminDepartments";
import { departmentFormLoader } from "@/loaders/departmentForm";

const AdminDepartments = lazy(() => import("@/pages/departments/index"));
const AdminDepartmentForm = lazy(() => import("@/pages/departments/form"));

export const departmentRoutes: RouteObject = {
  path: "departments",
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.DEPARTMENTS_ACCESS}>
      <Outlet />
    </RoleRoute>
  ),
  children: [
    {
      index: true,
      element: <AdminDepartments />,
      loader: adminDepartmentsLoader,
    },
    {
      path: "new",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.DEPARTMENTS_MANAGE}>
          <AdminDepartmentForm />
        </RoleRoute>
      ),
    },
    {
      path: ":slug/edit",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.DEPARTMENTS_MANAGE}>
          <AdminDepartmentForm />
        </RoleRoute>
      ),
      loader: departmentFormLoader,
    },
  ],
};
