/**
 * Custom hook for managing page-level filter state.
 * Wraps the filters Redux slice to provide a simple, typed API for
 * hydrating, reading, and updating filters scoped to a specific page.
 *
 * Usage:
 * ```ts
 * const { filters, setFilter, setFilters, resetFilters } = usePageFilters(
 *   "candidates",
 *   { search: "", status: "all", page: 1 },
 * );
 * ```
 */

import { useEffect, useCallback, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setFilter as setFilterAction,
  setFilters as setFiltersAction,
  resetFilters as resetFiltersAction,
  hydratePageFilters,
  selectPageFilters,
} from "@/store/slices/filtersSlice";

/**
 * Manages filter state for a given page, persisted in Redux and sessionStorage.
 *
 * @template T - The shape of the filter object.
 * @param pageKey - Unique identifier for the page (e.g. "candidates").
 * @param defaults - Default filter values used on first hydration.
 * @returns An object containing the current filters and mutation helpers.
 */
export function usePageFilters<T extends Record<string, any>>(
  pageKey: string,
  defaults: T,
): {
  /** Current merged filter values (defaults overridden by stored values). */
  filters: T;
  /** Sets a single filter value by key. */
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  /** Merges a partial set of filter values. */
  setFilters: (partial: Partial<T>) => void;
  /** Resets all filters for this page back to defaults. */
  resetFilters: () => void;
} {
  const dispatch = useAppDispatch();

  // Keep a stable ref to defaults so the hydration effect doesn't re-run
  // when consumers pass an inline object literal.
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  // Hydrate from sessionStorage (or defaults) on mount.
  useEffect(() => {
    dispatch(
      hydratePageFilters({ pageKey, defaults: defaultsRef.current }),
    );
  }, [dispatch, pageKey]);

  // Select the stored filter values for this page.
  const selectFilters = useMemo(() => selectPageFilters(pageKey), [pageKey]);
  const storedFilters = useAppSelector(selectFilters);

  // Merge defaults with stored values so callers always see a complete T.
  const filters = useMemo(
    () => ({ ...defaults, ...storedFilters }) as T,
    [defaults, storedFilters],
  );

  /** Sets a single filter value by key. */
  const setFilter = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      dispatch(
        setFilterAction({ pageKey, key: key as string, value }),
      );
    },
    [dispatch, pageKey],
  );

  /** Merges a partial set of filter values into the page's filters. */
  const setFilters = useCallback(
    (partial: Partial<T>) => {
      dispatch(
        setFiltersAction({
          pageKey,
          filters: partial as Record<string, any>,
        }),
      );
    },
    [dispatch, pageKey],
  );

  /** Resets all filters for this page, clearing Redux and sessionStorage. */
  const resetFilters = useCallback(() => {
    dispatch(resetFiltersAction(pageKey));
  }, [dispatch, pageKey]);

  return { filters, setFilter, setFilters, resetFilters };
}
