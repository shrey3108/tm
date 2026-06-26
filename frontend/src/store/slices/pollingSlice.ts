/**
 * Redux slice for managing active candidate stage evaluation background pollings.
 * Persists active pollings list in sessionStorage to handle browser refreshes.
 * Clears polling state on logout.
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { logout } from "@/store/slices/authSlice";

export interface PollingEntry {
  type?: "evaluation" | "resume";
  stageId: string; // Used as the unique task/polling key in the state
  candidateName: string;
  stageName?: string; // Optional for resume processing
  candidateId?: string;
  jobId?: string;
  jobTitle?: string;
  fileName?: string;
}

interface PollingState {
  activePollings: PollingEntry[];
}

const SESSION_KEY = "activeCandidatePollings";

const loadActivePollings = (): PollingEntry[] => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveActivePollings = (pollings: PollingEntry[]) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(pollings));
  } catch (error) {
    console.error("Failed to save active pollings to sessionStorage:", error);
  }
};

const initialState: PollingState = {
  activePollings: loadActivePollings(),
};

const pollingSlice = createSlice({
  name: "polling",
  initialState,
  reducers: {
    /**
     * Starts tracking a new candidate stage evaluation.
     */
    startPolling: (state, action: PayloadAction<PollingEntry>) => {
      const exists = state.activePollings.some(
        (p) => p.stageId === action.payload.stageId
      );
      if (!exists) {
        state.activePollings.push(action.payload);
        saveActivePollings(state.activePollings);
      }
    },
    /**
     * Stops tracking a candidate stage evaluation.
     */
    stopPolling: (state, action: PayloadAction<string>) => {
      state.activePollings = state.activePollings.filter(
        (p) => p.stageId !== action.payload
      );
      saveActivePollings(state.activePollings);
    },
    /**
     * Clears all active pollings.
     */
    clearAllPolling: (state) => {
      state.activePollings = [];
      sessionStorage.removeItem(SESSION_KEY);
    },
  },
  extraReducers: (builder) => {
    /**
     * On logout, clear all active background pollings.
     */
    builder.addCase(logout, (state) => {
      state.activePollings = [];
      sessionStorage.removeItem(SESSION_KEY);
    });
  },
});

export const { startPolling, stopPolling, clearAllPolling } = pollingSlice.actions;

export default pollingSlice.reducer;

/**
 * Selector to retrieve the list of active pollings.
 */
export const selectActivePollings = (state: { polling: PollingState }) =>
  state.polling.activePollings;
