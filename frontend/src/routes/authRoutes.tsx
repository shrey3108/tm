import { lazy } from "react";
import { type RouteObject } from "react-router-dom";
import PublicRoute from "@/components/auth/PublicRoute";

const LoginPage = lazy(() => import("@/pages/Auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/Auth/RegisterPage"));
const AssociateReviewPage = lazy(() => import("@/pages/Public/AssociateReviewPage"));

export const authRoutes: RouteObject[] = [
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
];
