import { useRouteError, Navigate } from "react-router-dom";
import axios from "axios";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";

/**
 * RouteErrorBoundary component to catch loader and routing errors.
 * If the error is a 401 Unauthorized, it automatically redirects the user to the login page.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  console.error("Route error caught by boundary:", error);

  // 1. Check if the error is an Axios 401 response
  if (
    axios.isAxiosError(error) &&
    (error.response?.status === 401 || error.message?.includes("401"))
  ) {
    return <Navigate to="/login" replace />;
  }

  // 2. Check if the error has a status field of 401 (e.g. standard Response object or react-router error)
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    error.status === 401
  ) {
    return <Navigate to="/login" replace />;
  }

  // 3. Fallback UI for other unexpected errors
  const errorMessage =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "statusText" in error
      ? String(error.statusText)
      : "An unexpected error occurred while loading this page.";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-foreground animate-in fade-in duration-300">
      <Card className="max-w-md w-full text-center border border-border">
        <CardHeader className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-lg font-semibold">Unexpected Application Error</CardTitle>
          <CardDescription className="text-xs text-muted-foreground break-all">
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center pb-4">
          <Button
            onClick={() => {
              window.location.href = "/";
            }}
            variant="default"
          >
            Go to Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default RouteErrorBoundary;
