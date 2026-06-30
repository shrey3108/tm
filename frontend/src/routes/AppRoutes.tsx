/**
 * Application route configuration.
 * Defines all routes for the hiring platform with public/protected access control using React Router Data Mode.
 * Lazy loading is applied to large/admin-only sections to reduce initial bundle size.
 */

import { lazy } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PublicRoute from "@/components/auth/PublicRoute";

import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import RouteErrorBoundary from "@/components/shared/RouteErrorBoundary";

// Loaders
import { RootLayout } from "@/components/layout/RootLayout";
import { jobFormLoader } from "@/loaders/jobForm"
import { questionsBankLoader } from "@/loaders/questionsBank"
import { questionsBankEditLoader } from "@/loaders/questionsBankEdit";
import { adminDashboardLoader } from "@/loaders/adminDashboard";
import { adminUsersLoader } from "@/loaders/adminUsers";
import { adminRolesLoader } from "@/loaders/adminRoles";
import { adminAuditLogsLoader } from "@/loaders/adminAuditLogs";
import { adminRecentUploadsLoader } from "@/loaders/adminRecentUploads";
import { adminJobsLoader } from "@/loaders/adminJobs";
import { adminSkillsLoader } from "@/loaders/adminSkills";
import { adminAssociatesLoader } from "@/loaders/adminAssociates";
import { adminDepartmentsLoader, } from "@/loaders/adminDepartments";
import { adminJobPositionsLoader } from "@/loaders/adminJobPositions";
import { adminCandidateSearchLoader } from "@/loaders/adminCandidateSearch";
import { adminJobCriteriaLoader } from "@/loaders/adminJobCriteria";
import { adminJobCriteriaFormLoader } from "@/loaders/adminJobCriteriaForm";
import { adminJobStagesLoader } from "@/loaders/adminJobStages";
import { adminJobStageFormLoader, } from "@/loaders/adminJobStageForm";

// Lazy-loaded route pages
const LoginPage = lazy(() => import("@/pages/Auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/Auth/RegisterPage"));
const DashboardLayout = lazy(() => import("@/components/layout/DashboardLayout"));
const JobBoard = lazy(() => import("@/pages/dashboard/job-board"));

// Lazy-loaded route components
const JobForm = lazy(() => import("@/pages/dashboard/JobForm"));
const JobCandidates = lazy(() => import("@/pages/dashboard/JobCandidates"));
const CandidatesStages = lazy(() => import("@/pages/dashboard/CandidatesStages"));
const TranscriptPage = lazy(() => import("@/pages/dashboard/TranscriptPage"));
const QuestionsBank = lazy(() => import("@/pages/dashboard/QuestionsBank"));
const QuestionsBankCreate = lazy(() => import("@/pages/dashboard/QuestionsBankCreate"));
const AssignPaperPage = lazy(() => import("@/pages/dashboard/AssignPaperPage"));
const AssignAssociatePage = lazy(() => import("@/pages/dashboard/AssignAssociatePage"));
const SendPaperPage = lazy(() => import("@/pages/dashboard/SendPaperPage"));
const AssociateReviewPage = lazy(() => import("@/pages/Public/AssociateReviewPage"));

// Admin pages
const AdminDashboard = lazy(() => import("@/pages/Admin/AdminDashboard"));
const AdminUsers = lazy(() => import("@/pages/Admin/AdminUsers"));
const AdminRoles = lazy(() => import("@/pages/Admin/AdminRoles"));
const AdminAuditLogs = lazy(() => import("@/pages/Admin/AdminAuditLogs"));
const AdminRecentUploads = lazy(() => import("@/pages/Admin/AdminRecentUploads"));
const AdminJobs = lazy(() => import("@/pages/Admin/AdminJobs"));
const AdminCandidateSearch = lazy(() => import("@/pages/Admin/AdminCandidateSearch"));
const AdminSkills = lazy(() => import("@/pages/Admin/AdminSkills"));
const AdminAssociates = lazy(() => import("@/pages/Admin/AdminAssociates"));
const AdminDepartments = lazy(() => import("@/pages/Admin/AdminDepartments"));
const AdminJobStages = lazy(() => import("@/pages/Admin/AdminJobStages"));
const AdminJobCriteria = lazy(() => import("@/pages/Admin/AdminJobCriteria"));
const AdminJobCriteriaForm = lazy(() => import("@/pages/Admin/AdminJobCriteriaForm"));
const AdminJobStageForm = lazy(() => import("@/pages/Admin/AdminJobStageForm"));
const AdminJobPriorities = lazy(() => import("@/pages/Admin/settings/AdminJobPriorities"));
const AdminPrompts = lazy(() => import("@/pages/Admin/settings/AdminPrompts"));
const AdminJobPositions = lazy(() => import("@/pages/Admin/AdminJobPositions"));


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
      {
        path: "register",
        element: (
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        ),
      },
      {
        path: "login",
        element: (
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        ),
      },
      {
        path: "associate-reviews/:token",
        element: <AssociateReviewPage />,
      },
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
          {
            path: "jobs",
            children: [
              {
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.JOBS_ACCESS}>
                    <Outlet />
                  </RoleRoute>
                ),
                children: [
                  {
                    index: true,
                    element: <JobBoard />,
                  },
                ],
              },
              {
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.JOBS_MANAGE}>
                    <Outlet />
                  </RoleRoute>
                ),
                children: [
                  {
                    path: "new",
                    element: <JobForm />,
                    loader: jobFormLoader,
                  },
                  {
                    path: ":jobSlug/edit",
                    element: <JobForm />,
                    loader: jobFormLoader,
                  },
                ],
              },
              {
                path: ":jobSlug/candidates",
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.CANDIDATES_ACCESS}>
                    <Outlet />
                  </RoleRoute>
                ),
                children: [
                  {
                    index: true,
                    element: <JobCandidates />,
                  },
                  {
                    path: ":candidateName/stages/:stageSlug",
                    children: [
                      {
                        index: true,
                        element: <CandidatesStages />,
                      },
                      {
                        path: "transcript",
                        element: <TranscriptPage />,
                      },
                      {
                        path: "assign-associate",
                        element: <AssignAssociatePage />,
                      },
                      {
                        path: "send-paper",
                        element: <SendPaperPage />,
                      },
                    ],
                  },
                ],
              },
              {
                path: ":jobSlug/assign-paper",
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.QUESTIONS_MANAGE}>
                    <AssignPaperPage />
                  </RoleRoute>
                ),
              },
              {
                path: ":jobSlug/send-paper",
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.QUESTIONS_MANAGE}>
                    <SendPaperPage />
                  </RoleRoute>
                ),
              },
            ],
          },
          {
            path: "questions-bank",
            element: (
              <RoleRoute requiredPermissions={PERMISSIONS.JOBS_ACCESS}>
                <QuestionsBank />
              </RoleRoute>
            ),
            loader: questionsBankLoader,
          },
          {
            path: "questions-bank/new",
            element: (
              <RoleRoute requiredPermissions={PERMISSIONS.QUESTIONS_MANAGE}>
                <QuestionsBankCreate />
              </RoleRoute>
            ),
            loader: questionsBankEditLoader,
          },
          {
            path: "questions-bank/:slug/edit",
            element: (
              <RoleRoute requiredPermissions={PERMISSIONS.QUESTIONS_MANAGE}>
                <QuestionsBankCreate />
              </RoleRoute>
            ),
            loader: questionsBankEditLoader,
          },
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
              {
                index: true,
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.ANALYTICS_READ}>
                    <AdminDashboard />
                  </RoleRoute>
                ),
                loader: adminDashboardLoader,
              },
              {
                path: "users",
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.USERS_READ}>
                    <AdminUsers />
                  </RoleRoute>
                ),
                loader: adminUsersLoader,
              },
              {
                path: "roles",
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.ROLES_READ}>
                    <AdminRoles />
                  </RoleRoute>
                ),
                loader: adminRolesLoader,
              },
              {
                path: "audit-logs",
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.AUDIT_READ}>
                    <AdminAuditLogs />
                  </RoleRoute>
                ),
                loader: adminAuditLogsLoader,
              },
              {
                path: "recent-uploads",
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.FILES_READ}>
                    <AdminRecentUploads />
                  </RoleRoute>
                ),
                loader: adminRecentUploadsLoader,
              },
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
                path: "skills",
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.SKILLS_ACCESS}>
                    <AdminSkills />
                  </RoleRoute>
                ),
                loader: adminSkillsLoader,
              },
              {
                path: "associates",
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.ASSOCIATES_ACCESS}>
                    <AdminAssociates />
                  </RoleRoute>
                ),
                loader: adminAssociatesLoader,
              },
              {
                path: "departments",
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.DEPARTMENTS_ACCESS}>
                    <AdminDepartments />
                  </RoleRoute>
                ),
                loader: adminDepartmentsLoader,
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
              {
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
                  {
                    path: "positions",
                    element: <AdminJobPositions />,
                    loader: adminJobPositionsLoader,
                  },
                ],
              },
              {
                path: "settings/priorities",
                element: (
                  <RoleRoute requiredPermissions={PERMISSIONS.ADMIN_ACCESS}>
                    <AdminJobPriorities />
                  </RoleRoute>
                ),
              },
              {
                path: "settings/prompts",
                element: (
                  <RoleRoute requiredPermissions={[PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.ANALYTICS_READ]}>
                    <AdminPrompts />
                  </RoleRoute>
                ),
              },
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
