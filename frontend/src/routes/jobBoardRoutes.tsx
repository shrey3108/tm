import { lazy } from "react";
import { type RouteObject, Outlet } from "react-router-dom";
import RoleRoute from "@/components/auth/RoleRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { jobFormLoader } from "@/loaders/jobForm";

const JobBoard = lazy(() => import("@/pages/dashboard/job-board"));
const JobForm = lazy(() => import("@/pages/dashboard/JobForm"));
const JobCandidates = lazy(() => import("@/pages/dashboard/JobCandidates"));
const CandidatesStages = lazy(() => import("@/pages/dashboard/CandidatesStages"));
const CandidateOverview = lazy(() => import("@/pages/dashboard/CandidateOverview"));
const TranscriptPage = lazy(() => import("@/pages/dashboard/TranscriptPage"));
const AssignPaperPage = lazy(() => import("@/pages/dashboard/AssignPaperPage"));
const AssignAssociatePage = lazy(() => import("@/pages/dashboard/AssignAssociatePage"));
const SendPaperPage = lazy(() => import("@/pages/dashboard/SendPaperPage"));

export const jobBoardRoutes: RouteObject = {
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
            {
              path: "assign-paper",
              element: <AssignPaperPage />,
            },
          ],
        },
        {
          path: ":candidateName/overview",
          element: <CandidateOverview />,
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
};
