import { lazy } from "react";
import { type RouteObject, Outlet } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { questionsBankLoader } from "@/loaders/questionsBank";
import { questionsBankEditLoader } from "@/loaders/questionsBankEdit";

const QuestionsBank = lazy(() => import("@/pages/dashboard/QuestionsBank"));
const QuestionsBankCreate = lazy(() => import("@/pages/dashboard/QuestionsBankCreate"));

export const questionsBankRoutes: RouteObject = {
  path: "questions-bank",
  element: (
    <RoleRoute requiredPermissions={PERMISSIONS.JOBS_ACCESS}>
      <Outlet />
    </RoleRoute>
  ),
  children: [
    {
      index: true,
      element: <QuestionsBank />,
      loader: questionsBankLoader,
    },
    {
      path: "new",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.QUESTIONS_MANAGE}>
          <QuestionsBankCreate />
        </RoleRoute>
      ),
      loader: questionsBankEditLoader,
    },
    {
      path: ":slug/edit",
      element: (
        <RoleRoute requiredPermissions={PERMISSIONS.QUESTIONS_MANAGE}>
          <QuestionsBankCreate />
        </RoleRoute>
      ),
      loader: questionsBankEditLoader,
    },
  ],
};
