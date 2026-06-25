/**
 * Redux store configuration for the hiring platform.
 * Configures the store with all application slices including authentication state.
 */

import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import filtersReducer from "@/store/slices/filtersSlice";
import pollingReducer from "@/store/slices/pollingSlice";

/**
 * The main Redux store for the application.
 * Contains authentication state and any future application slices.
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    filters: filtersReducer,
    polling: pollingReducer,
  },
});

/**
 * Type representing the root state of the Redux store.
 * Used for selecting slices and typing useSelector hooks.
 */
export type RootState = ReturnType<typeof store.getState>;

/**
 * Type representing the dispatch function for the Redux store.
 * Used for typing useDispatch hooks with proper middleware.
 */
export type AppDispatch = typeof store.dispatch;
