/**
 * @module error
 * Utility functions for handling, extracting, and formatting errors in a user-friendly format.
 */
import axios from "axios";
/**
 * Extracts a user-friendly error message from any error object, specializing in Axios HTTP errors.
 *
 * Supports:
 * - FastAPI validation error lists (arrays of errors under `detail`).
 * - Standard FastAPI or generic backend `detail` error strings.
 * - GlobalErrorHandlerMiddleware nested structure (nested `error.message` field).
 * - Standard JavaScript `Error` objects (`err.message`).
 * - Fallbacks for unknown error structures.
 *
 * @param err - The error object to extract the message from.
 * @param fallback - Default message returned if extraction fails.
 * @returns A user-friendly error message string.
 * @example
 * ```ts
 * try {
 *   await api.getUser();
 * } catch (err) {
 *   const msg = extractErrorMessage(err, "Failed to load user.");
 * }
 * ```
 */
export const extractErrorMessage = (
  err: unknown,
  fallback: string = "An unexpected error occurred.",
): string => {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;

    // Handle FastAPI validation errors (error is array of errors)
    if (Array.isArray(detail)) {
      return detail.map((e: any) => `${e.loc.join(".")}: ${e.msg}`).join(", ");
    }

    // Handle standard detail string
    if (typeof detail === "string") {
      return detail;
    }

    // Handle GlobalErrorHandlerMiddleware nested error structure
    const nestedError = err.response?.data?.error;
    if (nestedError && typeof nestedError.message === "string") {
      return nestedError.message;
    }

    return err.response?.data?.message || err.message || fallback;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
};
