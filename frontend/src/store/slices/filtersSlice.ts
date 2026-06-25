/**
 * Redux slice for managing page-level filter state with sessionStorage persistence.
 * Provides a generic, page-keyed approach to storing and hydrating filters
 * so that filter selections survive page navigation within a session.
 *
 * Automatically clears persisted filters on logout via the authSlice logout action.
 */

import { createSlice, createSelector, type PayloadAction } from "@reduxjs/toolkit";
import { logout } from "@/store/slices/authSlice";


/**
 * Shape of the filters slice state.
 * Each key in `pages` represents a unique page identifier,
 * mapping to that page's active filter values.
 */
interface FiltersState {
  pages: Record<string, Record<string, any>>;
}

const initialState: FiltersState = { pages: {} };


/** Prefix used for all sessionStorage keys managed by this slice. */
const SESSION_KEY_PREFIX = "pageFilters_";

/**
 * Loads persisted filters for a given page key from sessionStorage.
 *
 * @param pageKey - Unique identifier for the page.
 * @returns The parsed filter object, or `null` if not found or on error.
 */
function loadFromSession(pageKey: string): Record<string, any> | null {
  try {
    const raw = sessionStorage.getItem(`${SESSION_KEY_PREFIX}${pageKey}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Persists the filter object for a given page key to sessionStorage.
 *
 * @param pageKey - Unique identifier for the page.
 * @param filters - The filter values to persist.
 */
function saveToSession(
  pageKey: string,
  filters: Record<string, any>,
): void {
  sessionStorage.setItem(
    `${SESSION_KEY_PREFIX}${pageKey}`,
    JSON.stringify(filters),
  );
}

/**
 * Removes the persisted filters for a single page key from sessionStorage.
 *
 * @param pageKey - Unique identifier for the page.
 */
function clearFromSession(pageKey: string): void {
  sessionStorage.removeItem(`${SESSION_KEY_PREFIX}${pageKey}`);
}

/**
 * Removes all persisted page-filter entries from sessionStorage.
 * Iterates over every sessionStorage key and removes those matching the prefix.
 */
function clearAllFromSession(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(SESSION_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => sessionStorage.removeItem(key));
}



const filtersSlice = createSlice({
  name: "filters",
  initialState,
  reducers: {
    /**
     * Sets a single filter value for a page.
     * Creates the page entry if it does not already exist.
     */
    setFilter(
      state,
      action: PayloadAction<{ pageKey: string; key: string; value: any }>,
    ) {
      const { pageKey, key, value } = action.payload;
      if (!state.pages[pageKey]) {
        state.pages[pageKey] = {};
      }
      state.pages[pageKey][key] = value;
      saveToSession(pageKey, state.pages[pageKey]);
    },

    /**
     * Merges multiple filter values into a page's existing filters.
     * Creates the page entry if it does not already exist.
     */
    setFilters(
      state,
      action: PayloadAction<{ pageKey: string; filters: Record<string, any> }>,
    ) {
      const { pageKey, filters } = action.payload;
      if (!state.pages[pageKey]) {
        state.pages[pageKey] = {};
      }
      Object.assign(state.pages[pageKey], filters);
      saveToSession(pageKey, state.pages[pageKey]);
    },

    /**
     * Hydrates filter state for a page from sessionStorage on mount.
     * If the page key already exists in state, this is a no-op.
     * Otherwise, attempts to load from sessionStorage and falls back to the
     * provided defaults.
     */
    hydratePageFilters(
      state,
      action: PayloadAction<{ pageKey: string; defaults: Record<string, any> }>,
    ) {
      const { pageKey, defaults } = action.payload;
      if (state.pages[pageKey]) return;

      const persisted = loadFromSession(pageKey);
      state.pages[pageKey] = persisted ?? { ...defaults };
    },

    /**
     * Resets filters for a single page, removing them from both Redux state
     * and sessionStorage.
     */
    resetFilters(state, action: PayloadAction<string>) {
      const pageKey = action.payload;
      delete state.pages[pageKey];
      clearFromSession(pageKey);
    },

    /**
     * Resets all page filters, clearing both Redux state and every
     * page-filter entry in sessionStorage.
     */
    resetAllFilters(state) {
      state.pages = {};
      clearAllFromSession();
    },
  },

  extraReducers: (builder) => {
    /**
     * On logout, clear all persisted filter state so the next user
     * starts with a clean slate.
     */
    builder.addCase(logout, (state) => {
      state.pages = {};
      clearAllFromSession();
    });
  },
});


export const {
  setFilter,
  setFilters,
  hydratePageFilters,
  resetFilters,
  resetAllFilters,
} = filtersSlice.actions;

export default filtersSlice.reducer;

const EMPTY_OBJECT = {};
const selectFiltersState = (state: { filters: FiltersState }) => state.filters;

/**
 * Selector factory that returns the filter values for a specific page.
 * Returns an empty object when the page has no stored filters.
 *
 * @param pageKey - Unique identifier for the page.
 * @returns A selector function compatible with `useAppSelector`.
 */
export const selectPageFilters = (pageKey: string) =>
  createSelector(
    [selectFiltersState],
    (filters) => filters.pages[pageKey] || EMPTY_OBJECT
  );
