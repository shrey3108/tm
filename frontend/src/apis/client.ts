import axios from "axios";
import { store } from "@/store";
import { setCredentials, logout } from "@/store/slices/authSlice";

/**
 * Axios HTTP client configured for the hiring platform API.
 * Includes authentication token injection and automatic 401 handling.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

/**
 * Pre-configured axios instance for API communication.
 * Automatically includes Authorization header with JWT token.
 * Clears tokens on 401 responses to handle session expiration.
 */
const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  paramsSerializer: {
    indexes: null, // Serializes arrays as ?key=val1&key=val2 instead of ?key[0]=val1
  },
});

// Request interceptor: browser handles cookie forwarding via withCredentials: true
apiClient.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error),
);

/**
 * Flag to prevent multiple simultaneous refresh token requests.
 */
let isRefreshing = false;

/**
 * Queue to store failed requests while a token refresh is in progress.
 */
let failedQueue: any[] = [];

/**
 * Processes the queue of failed requests after a token refresh attempt.
 * @param error - Error object if refresh failed, null otherwise
 */
const processQueue = (error: any) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

/**
 * Response interceptor that handles authentication errors.
 * Attempts to automatically refresh tokens on 401 Unauthorized responses via HttpOnly cookie.
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and not already a retry or refresh attempt
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/users/refresh")
    ) {
      if (isRefreshing) {
        // If already refreshing, add request to queue
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Use apiClient directly to avoid circular dependency with authService.
        // Refresh token is automatically sent via HttpOnly cookie.
        const response = await apiClient.post("/users/refresh");
        const { user } = response.data;

        // Update Redux state & user storage
        store.dispatch(setCredentials({ user }));

        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        // If refresh fails, log out the user
        processQueue(refreshError);
        store.dispatch(logout());
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Default 401 handling if refresh is not possible
    if (error.response?.status === 401) {
      store.dispatch(logout());
    }

    return Promise.reject(error);
  },
);

export default apiClient;
