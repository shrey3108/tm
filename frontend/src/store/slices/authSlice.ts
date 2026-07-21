/**
 * Authentication slice for Redux state management.
 * Manages user session, tokens, and authentication status.
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { UserRead } from "@/types/auth";

/**
 * Shape of the authentication state in Redux store.
 */
interface AuthState {
  /** Currently authenticated user, null if not logged in */
  user: UserRead | null;
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
}

/**
 * Utility to safe parse JSON from sessionStorage.
 */
const getStoredUser = (): UserRead | null => {
  const storedUser = sessionStorage.getItem("user");
  if (!storedUser) return null;
  try {
    return JSON.parse(storedUser);
  } catch (error) {
    console.error("Failed to parse stored user:", error);
    sessionStorage.removeItem("user");
    return null;
  }
};

const initialState: AuthState = {
  user: getStoredUser(),
  isAuthenticated: !!getStoredUser(),
};

/**
 * Authentication Redux slice.
 * Handles login, logout, and user profile updates.
 */
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /**
     * Sets user credentials after successful login.
     * Updates state and persists user data to sessionStorage.
     */
    setCredentials: (
      state,
      action: PayloadAction<{ user: UserRead }>,
    ) => {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      sessionStorage.setItem("user", JSON.stringify(action.payload.user));
    },
    /**
     * Clears all authentication data on logout.
     * Removes user data from state and sessionStorage.
     */
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      sessionStorage.removeItem("user");
    },
    /**
     * Updates the user profile data in state and persists to localStorage or sessionStorage depending on the implementation.
     * Used when fetching or updating user information.
     */
    setUser: (state, action: PayloadAction<UserRead>) => {
      state.user = action.payload;
      // localStorage.setItem("user", JSON.stringify(action.payload));
      sessionStorage.setItem("user", JSON.stringify(action.payload));
    },
  },
});

export const { setCredentials, logout, setUser } = authSlice.actions;

export default authSlice.reducer;

/**
 * Selector to get the currently authenticated user.
 * @param state - Redux state object
 * @returns The current user object or null if not authenticated
 */
export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user;

/**
 * Selector to check if the user is authenticated.
 * @param state - Redux state object
 * @returns True if user has valid token, false otherwise
 */
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
