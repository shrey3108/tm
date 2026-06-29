import { useRouteError, Navigate } from "react-router-dom";
import axios from "axios";

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 text-center border border-gray-100 dark:border-gray-700">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Unexpected Application Error
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {errorMessage}
        </p>
        <button
          onClick={() => {
            window.location.href = "/";
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition cursor-pointer"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}

export default RouteErrorBoundary;
