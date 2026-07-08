import { lazy } from "react";
import { type RouteObject, Outlet } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { adminSkillsLoader } from "@/loaders/adminSkills";
import { skillFormLoader } from "@/loaders/skillForm";

const AdminSkills = lazy(() => import("@/pages/skills/index"));
const AdminSkillForm = lazy(() => import("@/pages/skills/form"));

export const skillRoutes: RouteObject = {
  path: "skills",
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.SKILLS_ACCESS}>
      <Outlet />
    </RoleRoute>
  ),
  children: [
    {
      index: true,
      element: <AdminSkills />,
      loader: adminSkillsLoader,
    },
    {
      path: "new",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.SKILLS_MANAGE}>
          <AdminSkillForm />
        </RoleRoute>
      ),
    },
    {
      path: ":slug/edit",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.SKILLS_MANAGE}>
          <AdminSkillForm />
        </RoleRoute>
      ),
      loader: skillFormLoader,
    },
  ],
};
