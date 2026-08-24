import { lazy } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import PublicRoute from "@/components/auth/PublicRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

const LoginPage = lazy(() => import("@/pages/Auth/LoginPage"));
const ZohoCallbackPage = lazy(() => import("@/pages/Auth/ZohoCallbackPage"));
const PendingApprovalPage = lazy(() => import("@/pages/Auth/PendingApprovalPage"));


export const authRoutes: RouteObject[] = [
  {
    path: "auth/callback",
    element: <ZohoCallbackPage />,
  },
  {
    path: "auth/pending",
    element: (
      <ProtectedRoute>
        <PendingApprovalPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "register",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "login",
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
];
