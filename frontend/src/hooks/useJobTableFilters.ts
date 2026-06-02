/**
 * @fileoverview Hooks for managing and applying filters to job tables.
 * Provides state management for filter criteria and logic for filtering job lists
 * and extracting unique filter options (departments, statuses) from job data.
 */

import { useMemo, useState } from "react";
import { startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { Job } from "@/types/job";
import type { DepartmentRead } from "@/types/admin";
import { useDebouncedValue } from "./useDebounced";
import { useDepartment } from "@/hooks/queries/admin/useDepartment";

/**
 * Hook for managing the state of job table filters.
 * Handles search text, status chips, department selection, and date ranges.
 * 
 * @returns An object containing filter states, their setters, and utility functions.
 * @example
 * const { titleFilter, setTitleFilter, clearFilters } = useJobTableFilters();
 */
export const useJobTableFilters = () => {
  const [titleFilter, setTitleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });
  const [departmentSearch, setDepartmentSearch] = useState("");

  const debouncedDepartmentSearch = useDebouncedValue(departmentSearch);
  const { data: allDepartments } = useDepartment(0, 100, debouncedDepartmentSearch);

  const hasActiveFilters =
    !!titleFilter ||
    statusFilter.length > 0 ||
    departmentFilter.length > 0 ||
    !!dateRange?.from ||
    !!dateRange?.to;

  const clearFilters = () => {
    setTitleFilter("");
    setStatusFilter([]);
    setDepartmentFilter([]);
    setDateRange({ from: undefined, to: undefined });
  };

  return {
    titleFilter,
    setTitleFilter,
    statusFilter,
    setStatusFilter,
    departmentFilter,
    setDepartmentFilter,
    dateRange,
    setDateRange,
    allDepartments: allDepartments || [],
    departmentSearch,
    setDepartmentSearch,
    hasActiveFilters,
    clearFilters,
  };
};

/**
 * Filters a list of jobs based on a selected date range and determines the date bounds.
 * 
 * @param jobs - The list of jobs to filter.
 * @param dateRange - The start and end dates for the filter.
 * @returns An object containing the filtered jobs and the minimum date found in the original list.
 */
export const useFilteredJobs = (jobs: Job[], dateRange: DateRange | undefined) => {
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      // Date range filter (created_at)
      if (j.created_at && (dateRange?.from || dateRange?.to)) {
        const d = new Date(j.created_at);
        if (dateRange.from && d < startOfDay(dateRange.from)) return false;
        if (dateRange.to && d > endOfDay(dateRange.to)) return false;
      }
      return true;
    });
  }, [jobs, dateRange]);

  const minDate = useMemo(() => {
    if (jobs.length === 0) return new Date();
    const dates = jobs.map((job) => new Date(job.created_at).getTime());
    return new Date(Math.min(...dates));
  }, [jobs]);

  return { filteredJobs, minDate };
};

/**
 * Extracts and sorts unique department options from a list of jobs or all available departments.
 * If server-side filters (title, status, department) are active, it derives options from the current job list.
 * Otherwise, it returns all available departments.
 * 
 * @param jobs - The current list of jobs (potentially filtered by server).
 * @param allDepartments - The full list of departments from the API.
 * @param titleFilter - Current job title search string.
 * @param statusFilter - Current list of selected status filters.
 * @param departmentFilter - Current list of selected department filters.
 * @returns A sorted list of unique department objects.
 */
export const useFilteredDepartmentOptions = (
  jobs: Job[],
  allDepartments: DepartmentRead[],
  titleFilter: string,
  statusFilter: string[] = [],
  departmentFilter: string[] = []
) => {
  const hasServerFilter = !!titleFilter || statusFilter.length > 0 || departmentFilter.length > 0;

  return useMemo(() => {
    if (!hasServerFilter) {
      return allDepartments;
    }
    const uniqueDeptsMap = new Map<string, DepartmentRead>();
    jobs.forEach((job) => {
      if (job.department) {
        const trimmedName = job.department.name.trim();
        if (!uniqueDeptsMap.has(trimmedName)) {
          uniqueDeptsMap.set(trimmedName, {
            id: job.department.id,
            name: trimmedName,
            description: job.department.description,
          } as DepartmentRead);
        }
      } else if (job.department_id && job.department_name) {
        const trimmedName = job.department_name.trim();
        if (!uniqueDeptsMap.has(trimmedName)) {
          uniqueDeptsMap.set(trimmedName, {
            id: job.department_id,
            name: trimmedName,
          } as DepartmentRead);
        }
      }
    });
    return Array.from(uniqueDeptsMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [jobs, allDepartments, hasServerFilter]);
};

/**
 * Extracts unique status options from the current list of jobs.
 * 
 * @param jobs - The current list of jobs.
 * @param titleFilter - Current job title search string.
 * @returns An array of unique status strings ("open", "closed").
 */
export const useFilteredStatusOptions = (
  jobs: Job[],
  titleFilter: string
) => {
  return useMemo(() => {
    if (!titleFilter) {
      return ["open", "closed"];
    }
    const uniqueStatuses = new Set<string>();
    jobs.forEach((job) => {
      uniqueStatuses.add(job.is_active ? "open" : "closed");
    });
    return Array.from(uniqueStatuses);
  }, [jobs, titleFilter]);
};
